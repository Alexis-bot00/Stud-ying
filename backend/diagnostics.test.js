import test from 'node:test';
import assert from 'node:assert/strict';
import { diagnosticMiddleware, diagnosticStage, safeDiagnosticError } from './diagnostics.js';
import { EventEmitter } from 'node:events';

test('diagnostic errors never echo secrets, prompts, record values or absolute paths', () => {
  const secret = 'synthetic-sensitive-sentinel';
  const error = Object.assign(new Error(secret), { name: secret, code: secret, stack: `Error: ${secret}\n at /private/${secret}/backend/storage/runtime.js:17:9` });
  const result = safeDiagnosticError(error);
  assert.equal(result.stackLocation, 'runtime.js:17:9');
  assert.equal(JSON.stringify(result).includes(secret), false);
  assert.equal(safeDiagnosticError({ name: 'Error', code: 'ENOENT' }).safeCode, 'ENOENT');
});
test('diagnostics are silent by default and enabled responses carry a safe correlation ID', () => {
  const old = process.env.DIAGNOSTIC_LOGGING, write = process.stdout.write;
  const logs = [];
  try {
    process.stdout.write = value => { logs.push(String(value)); return true; };
    process.env.DIAGNOSTIC_LOGGING = 'false';
    diagnosticStage('request_received', new Error('secret'));
    assert.equal(logs.length, 0);
    process.env.DIAGNOSTIC_LOGGING = 'true';
    const req = Object.assign(new EventEmitter(), { path: '/api/library?private=secret', method: 'POST', headers: { 'rndr-id': 'private@example.invalid', authorization: 'secret' } });
    const res = Object.assign(new EventEmitter(), { statusCode: 500, setHeader(k,v) { this.header=v; }, json(body) { this.body=body; return this; } });
    diagnosticMiddleware(req, res, () => { diagnosticStage('object_write_begin', new Error('secret')); res.json({ message: 'secret' }); });
    assert.match(res.header, /^[a-f0-9-]{36}$/);
    assert.equal(res.body.requestId, res.header);
    assert.equal(res.body.message.includes('secret'), false);
    assert.equal(logs.join('').includes('secret'), false);
    assert.equal(logs.join('').includes('private@example'), false);
    assert.equal(JSON.parse(logs[0]).route, '/api/library');
  } finally { process.stdout.write = write; if (old === undefined) delete process.env.DIAGNOSTIC_LOGGING; else process.env.DIAGNOSTIC_LOGGING = old; }
});
