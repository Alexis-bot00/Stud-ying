import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import fs from 'node:fs';
import { apiFailure, compareAuthenticatedTransports, sendAuthenticatedRequest } from '../src/lib/api-transport.ts';

const id = '12345678-abcd-4567-89ab-123456789abc';
const response = () => new Response('{}', { status: 200 });
test('shared authenticated GET and minimal global GET both pass the lightweight local endpoint', async () => {
  const credential = 'synthetic-session-only';
  const types = [];
  const server = http.createServer((req, res) => {
    const valid = req.url === '/api/admin/me' && req.method === 'GET' && req.headers.authorization === `Bearer ${credential}`;
    types.push(req.headers['content-type'] || null);
    res.writeHead(valid ? 200 : 401, { 'Content-Type': 'application/json', 'x-request-id': id });
    res.end('{}');
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  try {
    const result = await compareAuthenticatedTransports(`http://127.0.0.1:${server.address().port}`, credential,
      { globalFetch: fetch, multipartFetch: fetch, platform: 'android' });
    assert.deepEqual(result.rows.map(row => row.status), [200, 200]);
    assert.equal(result.sameFetchImplementation, true);
    assert.deepEqual(types, ['application/json', null]);
    assert.deepEqual(result.rows.map(row => row.requestId), [id, id]);
    assert.ok(result.rows.every(row => row.method === 'GET' && row.endpoint === '/api/admin/me'));
    assert.ok(!JSON.stringify(result).includes(credential));
  } finally { await new Promise(resolve => server.close(resolve)); }
});
test('JSON URL/body/signal/auth and native multipart selection remain unchanged', async () => {
  const signal = new AbortController().signal;
  const body = JSON.stringify({ synthetic: true });
  const calls = [];
  const globalFetch = async (url, options) => { calls.push({ mode: 'global', url, options }); return response(); };
  const multipartFetch = async (url, options) => { calls.push({ mode: 'multipart', url, options }); return response(); };
  const transports = { globalFetch, multipartFetch, platform: 'android' };
  await sendAuthenticatedRequest('http://127.0.0.1', '/api/schedule/scan', 'synthetic', { method: 'POST', body, signal }, transports);
  const form = new FormData(); form.append('question', 'Synthetic fixture.');
  await sendAuthenticatedRequest('http://127.0.0.1', '/api/chat', 'synthetic', { method: 'POST', body: form }, transports);
  assert.deepEqual(calls.map(call => call.mode), ['global', 'multipart']);
  assert.equal(calls[0].url, 'http://127.0.0.1/api/schedule/scan');
  assert.equal(calls[0].options.body, body); assert.equal(calls[0].options.signal, signal);
  assert.ok(calls[0].options.headers.Authorization === 'Bearer synthetic');
  assert.equal(calls[1].options.body, form); assert.ok(!('Content-Type' in calls[1].options.headers));
  await sendAuthenticatedRequest('http://127.0.0.1', '/api/library', '', { body: form }, { ...transports, platform: 'web' });
  assert.equal(calls[2].mode, 'global'); assert.ok(!('Authorization' in calls[2].options.headers));
});
test('gateway HTML and private upstream messages are replaced by safe 502/request IDs', () => {
  const sensitive = 'PRIVATE_FIXTURE_MUST_NOT_APPEAR';
  const error = apiFailure(sensitive, 502, new Response('', { status: 502, headers: { 'rndr-id': 'abcdef12-abcd-1234' } }), { message: sensitive });
  assert.equal(error.status, 502); assert.equal(error.requestIdSource, 'gateway');
  assert.ok(error.message.includes(error.requestId)); assert.ok(!error.message.includes(sensitive));
});
test('application ID wins; untrusted IDs are rejected; client IDs are labeled honestly', () => {
  const app = apiFailure('Sign in again.', 401, new Response('', { headers: { 'x-request-id': id, 'rndr-id': 'abcdef12-abcd-1234' } }));
  assert.equal(app.requestId, id); assert.equal(app.requestIdSource, 'application');
  assert.equal(app.message, 'Sign in again.');
  const error = apiFailure('Unavailable.', 503, new Response('', { headers: { 'x-request-id': 'PRIVATE_FIXTURE' } }));
  assert.equal(error.requestIdSource, 'client'); assert.ok(error.message.includes('client reference')); assert.ok(!error.message.includes('PRIVATE_FIXTURE'));
});
test('network exceptions and abort reasons are never echoed and writes are never retried', async () => {
  for (const name of ['TypeError', 'AbortError', 'TimeoutError']) {
    let attempts = 0;
    const transport = async () => { attempts++; throw Object.assign(new Error('PRIVATE_FIXTURE'), { name }); };
    await assert.rejects(sendAuthenticatedRequest('http://127.0.0.1', '/api/chat', 'synthetic', { method: 'POST' },
      { globalFetch: transport, multipartFetch: transport, platform: 'android' }), error => {
        assert.equal(error.status, 0); assert.ok(error.requestId); assert.ok(!error.message.includes('PRIVATE_FIXTURE')); return true;
      });
    assert.equal(attempts, 1);
  }
});
test('diagnostic cannot target production and does not perform writes', async () => {
  await assert.rejects(compareAuthenticatedTransports('https://example.invalid', 'synthetic', { globalFetch: fetch, multipartFetch: fetch, platform: 'android' }), /limited to the test backend/);
  const calls = [];
  const readOnly = async (url, options) => {
    calls.push({ url, method: options.method });
    assert.ok(options.signal instanceof AbortSignal);
    assert.equal(options.body, undefined);
    return response();
  };
  await compareAuthenticatedTransports('http://localhost', 'synthetic', { globalFetch: readOnly, multipartFetch: readOnly, platform: 'android' });
  assert.deepEqual(calls, Array(2).fill({ url: 'http://localhost/api/admin/me', method: 'GET' }));
});
test('installed SDK confirms global fetch replacement and Auth retains its direct global fetch', () => {
  const sdk = fs.readFileSync(new URL('../node_modules/expo/src/winter/runtime.native.ts', import.meta.url), 'utf8');
  assert.match(sdk, /install\('fetch', \(\) => require\('\.\/fetch'\).fetch\)/);
  const app = fs.readFileSync(new URL('../src/app/index.tsx', import.meta.url), 'utf8');
  assert.match(app, /const r = await fetch\(`\$\{API\}\/api\/auth/);
  assert.match(app, /globalFetch: fetch, multipartFetch: expoFetch/);
  assert.match(app, /transportProbe=\{API === 'https:\/\/studyante-backend-test\.onrender\.com'/);
  assert.match(app, /<Profile key=\{user\.id\}/);
  assert.match(app, /disabled=\{probeBusy\} onPress=\{runTransportProbe\}/);
  assert.match(app, /if \(!transportProbe \|\| probeActive\.current\) return/);
  assert.match(app, /return \(\) => \{ profileLive\.current = false; \}/);
});
