import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import express from 'express';
import { createStudyCircleRouter } from './study-circle.js';

test('only note owners invite accepted friends and invitees consent before reading or chatting', async () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'study-circle-test-'));
  const users = ['alice', 'bob', 'charlie'].map(id => ({ id, name: id }));
  fs.writeFileSync(path.join(directory, 'cappy-friends.json'), JSON.stringify({ links: [{ from: 'alice', to: 'bob', accepted: true }] }));
  const app = express(); app.use(express.json());
  app.use('/circle', createStudyCircleRouter({ directory, readUsers: () => users, readLibrary: () => ({ studyMaterials: [{ id: 'note1', userId: 'alice', type: 'notes', name: 'Biology', data: { notes: 'Cells are living building blocks.' } }] }), requireAuth: (req, res, next) => { req.user = { id: req.headers['x-user'] }; next(); } }));
  const server = app.listen(0, '127.0.0.1'); await new Promise(resolve => server.on('listening', resolve));
  const request = async (user, route = '', body, method) => { const r = await fetch(`http://127.0.0.1:${server.address().port}/circle${route}`, { method: method || (body ? 'POST' : 'GET'), headers: { 'x-user': user, 'Content-Type': 'application/json' }, ...(body ? { body: JSON.stringify(body) } : {}) }); return { status: r.status, data: await r.json() }; };
  try {
    assert.equal((await request('unknown')).status, 401);
    assert.equal((await request('bob', '', { noteId: 'note1', friendIds: ['alice'] })).status, 404);
    assert.equal((await request('alice', '', { noteId: 'note1', friendIds: ['charlie'] })).status, 400);
    const created = await request('alice', '', { noteId: 'note1', friendIds: ['bob'] }); assert.equal(created.status, 201);
    const id = created.data.session.id;
    const pending = (await request('bob')).data.sessions[0]; assert.equal(pending.status, 'pending'); assert.equal(pending.notes, undefined);
    assert.equal((await request('bob', `/${id}`)).status, 403);
    assert.equal((await request('bob', `/${id}/messages`, { text: 'Hello' })).status, 403);
    assert.equal((await request('charlie', `/${id}/respond`, { status: 'accepted' })).status, 404);
    assert.equal((await request('bob', `/${id}/respond`, { status: 'accepted' })).status, 200);
    assert.equal((await request('bob', `/${id}`)).data.session.notes, 'Cells are living building blocks.');
    assert.equal((await request('charlie', `/${id}`)).status, 403);
    assert.equal((await request('bob', `/${id}/messages`, { text: 'What is a cell?' })).status, 201);
    assert.equal((await request('alice', `/${id}`)).data.session.messages[0].text, 'What is a cell?');
    assert.equal((await request('bob', `/${id}/messages`, { text: ' ' })).status, 400);
    const second = (await request('alice', '', { noteId: 'note1', friendIds: ['bob'] })).data.session.id;
    assert.equal((await request('bob', `/${second}/respond`, { status: 'declined' })).status, 200);
    assert.equal((await request('bob', `/${second}`)).status, 403);
    assert.equal((await request('bob')).data.sessions.length, 1);
    assert.equal((await request('charlie', `/${id}`, undefined, 'DELETE')).status, 403);
    assert.equal((await request('bob', `/${id}`, undefined, 'DELETE')).status, 200);
    assert.equal((await request('bob', `/${id}`)).status, 403);
    assert.equal((await request('alice', `/${id}`, undefined, 'DELETE')).status, 200);
    assert.equal((await request('alice', `/${id}`)).status, 403);
  } finally { await new Promise(resolve => server.close(resolve)); fs.rmSync(directory, { recursive: true, force: true }); }
});
