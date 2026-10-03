import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import express from 'express';
import { createFriendsRouter, friendCode } from './cappy-friends.js';

test('friend consent and conversation access are enforced', async () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'cappy-friends-test-'));
  const app = express(); app.use(express.json());
  const users = ['alice', 'bob', 'charlie'].map(id => ({ id, name: id }));
  app.use('/friends', createFriendsRouter({ directory, readUsers: () => users, requireAuth: (req, res, next) => { if (!req.headers['x-test-user']) return res.status(401).json({}); req.user = { id: req.headers['x-test-user'] }; next(); } }));
  const server = app.listen(0, '127.0.0.1');
  await new Promise(resolve => server.on('listening', resolve));
  const url = `http://127.0.0.1:${server.address().port}/friends`;
  const request = async (user, endpoint = '', body, method) => {
    const response = await fetch(url + endpoint, { method: method || (body ? 'POST' : 'GET'), headers: { ...(user ? { 'x-test-user': user } : {}), 'Content-Type': 'application/json' }, ...(body ? { body: JSON.stringify(body) } : {}) });
    return { status: response.status, data: await response.json() };
  };
  try {
    assert.equal((await request('')).status, 401);
    assert.equal((await request('missing')).status, 401);
    assert.equal((await request('alice', '/bob/messages')).status, 403);
    assert.equal((await request('alice', '/request', { code: friendCode('alice') })).status, 400);
    assert.equal((await request('alice', '/request', { code: friendCode('bob') })).status, 201);
    assert.equal((await request('alice', '/request', { code: friendCode('bob') })).status, 409);
    assert.equal((await request('bob')).data.incoming[0].id, 'alice');
    assert.equal((await request('charlie', '/accept', { id: 'alice' })).status, 404);
    assert.equal((await request('bob', '/accept', { id: 'alice' })).status, 200);
    assert.equal((await request('alice')).data.friends[0].id, 'bob');
    assert.equal((await request('alice', '/bob/messages', { text: ' ' })).status, 400);
    assert.equal((await request('alice', '/bob/messages', { text: 'Study together?' })).status, 201);
    const conversation = await request('bob', '/alice/messages');
    assert.equal(conversation.data.messages[0].text, 'Study together?');
    assert.equal(conversation.data.messages[0].mine, false);
    assert.equal((await request('charlie', '/bob/messages')).status, 403);
    assert.equal((await request('alice', '/bob', undefined, 'DELETE')).status, 200);
    assert.equal((await request('alice', '/bob/messages')).status, 403);
  } finally {
    await new Promise(resolve => server.close(resolve));
    fs.rmSync(directory, { recursive: true, force: true });
  }
});
