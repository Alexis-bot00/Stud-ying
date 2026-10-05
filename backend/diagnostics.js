import { AsyncLocalStorage } from 'node:async_hooks';
import crypto from 'node:crypto';

const context = new AsyncLocalStorage();
const names = new Set(['Error', 'TypeError', 'ReferenceError', 'SyntaxError', 'RangeError', 'AbortError', 'TimeoutError', 'MulterError']);
const codes = new Set(['ENOENT', 'EACCES', 'ECONNRESET', 'ETIMEDOUT', 'ERR_HTTP_HEADERS_SENT', 'ERR_STREAM_WRITE_AFTER_END', 'LIMIT_FILE_SIZE']);
const stages = new Set(['request_received', 'response_failed', 'response_finished', 'response_closed', 'request_aborted', 'auth_enter', 'auth_verified', 'multipart_enter', 'multipart_complete', 'storage_queued', 'documents_read_begin', 'documents_read_complete', 'storage_context_ready', 'storage_bind', 'storage_context_missing', 'documents_commit_begin', 'documents_commit_complete', 'object_write_begin', 'object_write_complete', 'repository_failed', 'storage_failed', 'gemini_begin', 'gemini_complete', 'console_error', 'console_output', 'process_uncaught']);
export const diagnosticEnabled = () => process.env.DIAGNOSTIC_LOGGING === 'true';
function routeOf(req) {
  const path = String(req.path || '').split('?')[0];
  if (['/', '/api/library', '/api/generate', '/api/chat', '/api/schedule/scan', '/api/auth/register', '/api/auth/login'].includes(path)) return path;
  if (/^\/api\/library\/[^/]+\/file$/.test(path)) return '/api/library/:id/file';
  return '/other';
}
export function safeDiagnosticError(error) {
  const code = codes.has(error?.code) ? error.code : Number.isInteger(error?.status) && error.status >= 400 && error.status <= 599 ? `HTTP_${error.status}` : 'REDACTED_ERROR';
  // Never forward arbitrary error messages, URLs, objects or stack text.
  const safeMessage = code === 'ENOENT' ? 'A required local path is missing.' : code === 'EACCES' ? 'Local filesystem access was denied.' : code.startsWith('HTTP_') ? 'An upstream request failed.' : 'Error details withheld; use the safe code and stack location.';
  const location = String(error?.stack || '').match(/(?:^|[/\\])(server\.js|diagnostics\.js|runtime\.js|repository\.js|schedule-scan\.js):(\d+):(\d+)/m);
  return { errorName: names.has(error?.name) ? error.name : 'Error', safeCode: code, safeMessage, stackLocation: location ? `${location[1]}:${location[2]}:${location[3]}` : null };
}
export function diagnosticStage(stage, error) {
  if (!diagnosticEnabled()) return;
  const request = context.getStore();
  const row = { requestId: request?.requestId || null, utcTimestamp: new Date().toISOString(), route: request?.route || '/other', method: request?.method || 'OTHER', stage: stages.has(stage) ? stage : 'console_output', ...(error ? safeDiagnosticError(error) : {}) };
  process.stdout.write(JSON.stringify(row) + '\n');
}
export function diagnosticMiddleware(req, res, next) {
  if (!diagnosticEnabled()) return next();
  const incoming = req.headers['rndr-id'];
  const requestId = typeof incoming === 'string' && /^[a-f0-9-]{8,80}$/i.test(incoming) ? incoming : crypto.randomUUID();
  const state = { requestId, route: routeOf(req), method: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS', 'HEAD'].includes(req.method) ? req.method : 'OTHER' };
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
    res.once('finish', () => context.run(state, () => diagnosticStage('response_finished')));
    res.once('close', () => context.run(state, () => diagnosticStage('response_closed')));
    req.once('aborted', () => context.run(state, () => diagnosticStage('request_aborted')));
    next();
  });
}
export function installDiagnosticProcessLogging() {
  if (!diagnosticEnabled()) return;
  // Suppress legacy console payloads in diagnostic mode, including debug records.
  for (const method of ['log', 'warn', 'error']) console[method] = (...args) => diagnosticStage(method === 'error' ? 'console_error' : 'console_output', args.find(value => value instanceof Error));
  // Monitoring does not swallow exceptions or change Node's exit behavior.
  process.on('uncaughtExceptionMonitor', error => diagnosticStage('process_uncaught', error));
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
