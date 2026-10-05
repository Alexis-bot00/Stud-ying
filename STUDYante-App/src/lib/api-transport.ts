type Transport = typeof fetch;
export type ApiTransports = { globalFetch: Transport; multipartFetch: Transport; platform: string };

function clientId() {
  return `client-${Date.now().toString(16)}-${Math.random().toString(16).slice(2, 10)}`;
}

function safeId(value: unknown): string | null {
  return typeof value === 'string' && /^[a-f0-9]{8}(?:-[a-f0-9]{4}){2}(?:-[a-f0-9]{4}-[a-f0-9]{12})?$/i.test(value) ? value : null;
}

export function apiFailure(message: string, status: number, response?: Response, data?: any, fallback = clientId()) {
  const applicationId = safeId(response?.headers.get('x-request-id')) || safeId(data?.requestId);
  const gatewayId = safeId(response?.headers.get('rndr-id'));
  const requestId = applicationId || gatewayId || fallback;
  const requestIdSource = applicationId ? 'application' : gatewayId ? 'gateway' : 'client';
  const text = status === 502 ? 'The server gateway could not complete this request (502). Please try again.'
    : status >= 500 ? `The server could not complete this request (${status}). Please try again.` : message;
  const display = status === 0 || status >= 500
    ? `${text} Request ID: ${requestId}${requestIdSource === 'client' ? ' (client reference)' : ''}.` : text;
  return Object.assign(new Error(display), {
    status, requestId, requestIdSource,
  });
}

// Keep the existing transport selection and request wire shape during diagnosis.
// In SDK 57, globalFetch is itself Expo fetch on native unless explicitly opted out.
export async function sendAuthenticatedRequest(
  baseUrl: string, path: string, token: string, options: RequestInit, transports: ApiTransports,
) {
  const multipart = options.body instanceof FormData;
  const transport = multipart && transports.platform !== 'web' ? transports.multipartFetch : transports.globalFetch;
  const headers = {
    ...(multipart ? {} : { 'Content-Type': 'application/json' }),
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...(options.headers || {}),
  };
  try {
    return await transport(`${baseUrl}${path}`, { ...options, headers });
  } catch (error: any) {
    const aborted = options.signal?.aborted || error?.name === 'AbortError' || error?.name === 'TimeoutError';
    throw apiFailure(aborted ? 'The request was canceled or timed out. Please try again.' : 'Could not reach the server. Check your connection and try again.', 0);
  }
}

// Explicit read-only diagnostic. Never invoked automatically and never returns response data.
// Call from a test runtime with its private session token; do not paste tokens into a console/chat.
export async function compareAuthenticatedTransports(baseUrl: string, token: string, transports: ApiTransports) {
  const url = new URL(baseUrl);
  if (url.origin !== 'https://studyante-backend-test.onrender.com' && !['127.0.0.1', 'localhost'].includes(url.hostname)) {
    throw new Error('Transport comparison is limited to the test backend or loopback fixtures.');
  }
  const path = '/api/admin/me';
  const rows = [];
  for (const mode of ['shared', 'global'] as const) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 20000);
    const started = Date.now();
    const utcTimestamp = new Date().toISOString();
    try {
      const response = mode === 'shared'
        ? await sendAuthenticatedRequest(baseUrl, path, token, { method: 'GET', signal: controller.signal }, transports)
        : await transports.globalFetch(`${baseUrl}${path}`, { method: 'GET', signal: controller.signal, headers: { Authorization: `Bearer ${token}` } });
      const error = apiFailure('', response.status, response);
      rows.push({ mode, utcTimestamp, endpoint: path, method: 'GET', status: response.status,
        durationMs: Date.now() - started, requestId: error.requestId, requestIdSource: error.requestIdSource });
      // Release the body without parsing or retaining any account data.
      await response.arrayBuffer().catch(() => undefined);
    } catch (error: any) {
      const safe = error?.status === 0 && error?.requestIdSource === 'client' ? error : apiFailure('Could not reach the server.', 0);
      rows.push({ mode, utcTimestamp, endpoint: path, method: 'GET', status: 0,
        durationMs: Date.now() - started, requestId: safe.requestId, requestIdSource: safe.requestIdSource });
    } finally {
      clearTimeout(timer);
    }
  }
  return { rows, sameFetchImplementation: transports.globalFetch === transports.multipartFetch };
}
