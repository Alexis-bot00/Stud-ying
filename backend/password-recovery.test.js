import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import crypto from 'node:crypto';
import express from 'express';

test('HTTPS email sends through the fixed provider endpoint and rejects failed sends', async () => {
  const source = fs.readFileSync(new URL('./server.js', import.meta.url), 'utf8').split('/* STUDYANTE_FORGOT_PASSWORD_START */')[1].split('/* STUDYANTE_FORGOT_PASSWORD_END */')[0];
  let ok = false; let payload;
  const context = vm.createContext({ store: { bind: (req,res,next) => next() }, app: { post() {}, get() {} }, crypto, process: { env: { RESEND_API_KEY: 'test-only', RESET_EMAIL_FROM: 'sender@example.com' } }, requireAuth() {}, requireStudyanteAdmin() {}, AbortSignal, fetch: async (url, options) => { assert.equal(url, 'https://api.resend.com/emails'); payload = JSON.parse(options.body); return { ok, status: ok ? 200 : 403 }; } });
  vm.runInContext(source, context);
  const transport = context.studyanteGetMailTransporter();
  await assert.rejects(transport.sendMail({ to: 'alice@example.com', subject: 'Reset', text: 'test' }), /403/);
  ok = true; const result = await transport.sendMail({ to: 'alice@example.com', subject: 'Reset', text: 'test' });
  assert.equal(result.accepted[0], 'alice@example.com'); assert.equal(payload.from, 'sender@example.com'); assert.deepEqual(payload.to, ['alice@example.com']);
});

test('admin reset is protected and failed delivery does not prevent a retry', async () => {
  const source = fs.readFileSync(new URL('./server.js', import.meta.url), 'utf8').split('/* STUDYANTE_FORGOT_PASSWORD_START */')[1].split('/* STUDYANTE_FORGOT_PASSWORD_END */')[0];
  const app = express(); app.use(express.json()); let fail = true; let recipient; const logs = [];
  const requireAuth = (req, res, next) => req.headers['x-user'] ? (req.user = { id: req.headers['x-user'] }, next()) : res.status(401).json({});
  const requireStudyanteAdmin = (req, res, next) => req.user.id === 'admin' ? next() : res.status(403).json({});
  vm.runInNewContext(source, { store: { bind: (req,res,next) => next() }, app, crypto, process: { env: { SMTP_USER: 'sender@example.com', SMTP_PASS: 'test-only' } }, console: { log() {}, error() {} }, readUsers: () => [{ id: 'alice', email: 'alice@example.com' }], writeUsers() {}, bcrypt: {}, requireAuth, requireStudyanteAdmin, studyanteAdminLog: (...args) => logs.push(args), nodemailer: { createTransport: () => ({ sendMail: async options => { recipient = options.to; if (fail) throw new Error('connection failed'); return { accepted: [recipient] }; }, verify: async () => true, close() {} }) } });
  const server = app.listen(0, '127.0.0.1'); await new Promise(resolve => server.on('listening', resolve));
  const request = async (route, user, body) => { const r = await fetch(`http://127.0.0.1:${server.address().port}${route}`, { method: body ? 'POST' : 'GET', headers: { 'Content-Type': 'application/json', ...(user ? { 'x-user': user } : {}) }, ...(body ? { body: JSON.stringify(body) } : {}) }); return { status: r.status, data: await r.json() }; };
  try {
    assert.equal((await request('/api/admin/email-status')).status, 401);
    assert.equal((await request('/api/admin/email-status', 'alice')).status, 403);
    assert.equal((await request('/api/admin/email-status', 'admin')).data.ready, true);
    assert.equal((await request('/api/admin/users/alice/password-reset', 'alice', {})).status, 403);
    assert.equal((await request('/api/admin/users/alice/password-reset', 'admin', {})).status, 500);
    fail = false;
    assert.equal((await request('/api/admin/users/alice/password-reset', 'admin', { email: 'attacker@example.com' })).status, 200);
    assert.equal(recipient, 'alice@example.com'); assert.equal(logs.length, 2);
    assert.equal((await request('/api/auth/forgot-password', '', { email: recipient })).status, 429);
  } finally { await new Promise(resolve => server.close(resolve)); }
});
