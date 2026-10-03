import { test } from 'node:test';
import assert from 'node:assert/strict';
import { recordPresence, publicPresence } from './presence.js';

test('unknown activity is offline and heartbeat expiry retains last seen', () => {
  const user = {};
  const start = 1800000000000;
  assert.deepEqual(publicPresence(user, start), { online: false, lastSeenAt: null, onlineSeconds: 0 });
  recordPresence(user, start);
  recordPresence(user, start + 30000);
  assert.equal(publicPresence(user, start + 60000).onlineSeconds, 60);
  const expired = publicPresence(user, start + 120001);
  assert.equal(expired.online, false);
  assert.equal(expired.lastSeenAt, new Date(start + 30000).toISOString());
  recordPresence(user, start + 150000);
  assert.equal(publicPresence(user, start + 150000).onlineSeconds, 0);
});

test('continued check-ins preserve hours online', () => {
  const user = {};
  const start = 1800000000000;
  for (let elapsed = 0; elapsed <= 7200000; elapsed += 30000) recordPresence(user, start + elapsed);
  assert.equal(publicPresence(user, start + 7200000).onlineSeconds, 7200);
});
