import { AsyncLocalStorage } from 'node:async_hooks';
import crypto from 'node:crypto';

const context = new AsyncLocalStorage();
const names = new Set(['Error', 'TypeError', 'ReferenceError', 'SyntaxError', 'RangeError', 'AbortError', 'TimeoutError', 'MulterError']);
const codes = new Set(['ENOENT', 'EACCES', 'ECONNRESET', 'ETIMEDOUT', 'ERR_HTTP_HEADERS_SENT', 'ERR_STREAM_WRITE_AFTER_END', 'LIMIT_FILE_SIZE', 'LIMIT_UNEXPECTED_FILE']);
const parserTypes = new Set(['entity.parse.failed', 'entity.too.large', 'request.aborted', 'request.size.invalid', 'encoding.unsupported']);
const stages = new Set(['request_received', 'response_failed', 'response_finished', 'response_closed', 'request_aborted', 'body_parser_enter', 'body_parser_complete', 'body_parser_error', 'auth_enter', 'auth_verified', 'multipart_enter', 'multipart_complete', 'storage_queued', 'documents_read_begin', 'documents_read_complete', 'storage_context_ready', 'storage_bind', 'storage_context_missing', 'documents_commit_begin', 'documents_commit_complete', 'object_write_begin', 'object_write_complete', 'repository_failed', 'storage_failed', 'gemini_begin', 'gemini_complete', 'console_error', 'console_output', 'process_uncaught', 'process_rejection', 'process_exit']);
export const diagnosticEnabled = () => process.env.DIAGNOSTIC_LOGGING === 'true';
function routeOf(req) {
  const path = String(req.path || '').split('?')[0];
  if (['/', '/api/library', '/api/generate', '/api/chat', '/api/schedule/scan', '/api/auth/register', '/api/auth/login'].includes(path)) return path;
  if (/^\/api\/library\/[^/]+\/file$/.test(path)) return '/api/library/:id/file';
  return '/other';
}
export function safeDiagnosticError(error) {
  const code = codes.has(error?.code) ? error.code : parserTypes.has(error?.type) ? error.type : Number.isInteger(error?.status) && error.status >= 400 && error.status <= 599 ? `HTTP_${error.status}` : 'REDACTED_ERROR';
  // Never forward arbitrary error messages, URLs, objects or stack text.
  const safeMessage = code === 'ENOENT' ? 'A required local path is missing.' : code === 'EACCES' ? 'Local filesystem access was denied.' : code.startsWith('HTTP_') ? 'An upstream request failed.' : 'Error details withheld; use the safe code and stack location.';
  const location = String(error?.stack || '').match(/(?:^|[/\\])(server\.js|diagnostics\.js|runtime\.js|repository\.js|schedule-scan\.js):(\d+):(\d+)/m);
  return { errorName: names.has(error?.name) ? error.name : 'Error', safeCode: code, safeMessage, stackLocation: location ? `${location[1]}:${location[2]}:${location[3]}` : null };
}
export function diagnosticStage(stage, error) {
  if (!diagnosticEnabled()) return;
  const request = context.getStore();
  const row = { requestId: request?.requestId || null, utcTimestamp: new Date().toISOString(), route: request?.route || '/other', method: request?.method || 'OTHER', contentTypeCategory: request?.contentTypeCategory || 'none', contentLength: request?.contentLength ?? null, status: request?.status ?? null, durationMs: request ? Date.now() - request.started : null, stage: stages.has(stage) ? stage : 'console_output', ...(error ? safeDiagnosticError(error) : {}) };
  process.stdout.write(JSON.stringify(row) + '\n');
}
export function diagnosticMiddleware(req, res, next) {
  if (!diagnosticEnabled()) return next();
  const requestId = crypto.randomUUID();
  const type = typeof req.headers['content-type'] === 'string' ? req.headers['content-type'].split(';')[0].trim().toLowerCase() : '';
  const contentTypeCategory = type === 'application/json' || type.endsWith('+json') ? 'json' : type === 'multipart/form-data' ? 'multipart' : type === 'application/x-www-form-urlencoded' ? 'form' : type ? 'other' : 'none';
  const length = req.headers['content-length'];
  const contentLength = typeof length === 'string' && /^\d{1,16}$/.test(length) && Number.isSafeInteger(Number(length)) ? Number(length) : null;
  const state = { requestId, route: routeOf(req), method: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS', 'HEAD'].includes(req.method) ? req.method : 'OTHER', contentTypeCategory, contentLength, started: Date.now(), status: null };
  res.setHeader('X-Request-ID', requestId);
  const json = res.json.bind(res);
  res.json = body => {
    if (res.statusCode >= 400 && body && typeof body === 'object' && !Array.isArray(body)) {
      diagnosticStage('response_failed');
      body = { ...body, ...(res.statusCode >= 500 && Object.hasOwn(body, 'message') ? { message: 'Test request failed. Refer to the request ID.' } : {}), requestId };
    }
    return json(body);
  };
  context.run(state, () => {
    diagnosticStage('request_received');
    const lifecycle = stage => context.run(state, () => { state.status = res.statusCode; diagnosticStage(stage); });
    res.once('finish', () => lifecycle('response_finished'));
    res.once('close', () => lifecycle('response_closed'));
    req.once('aborted', () => lifecycle('request_aborted'));
    next();
  });
}
export function installDiagnosticProcessLogging() {
  if (!diagnosticEnabled()) return;
  // Suppress legacy console payloads in diagnostic mode, including debug records.
  for (const method of ['log', 'warn', 'error']) console[method] = (...args) => diagnosticStage(method === 'error' ? 'console_error' : 'console_output', args.find(value => value instanceof Error));
  // Monitoring does not swallow exceptions or change Node's exit behavior.
  process.on('uncaughtExceptionMonitor', (error, origin) => diagnosticStage(origin === 'unhandledRejection' ? 'process_rejection' : 'process_uncaught', error));
  process.on('exit', () => diagnosticStage('process_exit'));
}
export function instrumentDiagnosticParser(parser) {
  return (req, res, next) => {
    diagnosticStage('body_parser_enter');
    parser(req, res, error => { diagnosticStage(error ? 'body_parser_error' : 'body_parser_complete', error); next(error); });
  };
}
export function instrumentDiagnosticUpload(upload) {
  if (!diagnosticEnabled()) return;
  for (const method of ['single', 'fields', 'array', 'none', 'any']) {
    const original = upload[method].bind(upload);
    upload[method] = (...args) => {
      const middleware = original(...args);
      return (req, res, next) => {
        diagnosticStage('multipart_enter');
        middleware(req, res, error => { diagnosticStage('multipart_complete', error); next(error); });
      };
    };
  }
}
