import { test } from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import { createScheduleScanRouter, normalizeSchedule } from './schedule-scan.js';

test('schedule drafts keep uncertain details editable rather than inventing times', () => {
  const result = normalizeSchedule({ classes: [{ name: 'Math', day: 1, start: '09:00', end: '10:00' }, { name: 'Math', day: 1, start: '09:00', end: '10:00' }, { name: 'Biology', day: 8, start: '9 AM', end: null }, { name: '' }], warnings: ['Read carefully'] });
  assert.equal(result.classes.length, 2);
  assert.equal(result.classes[1].day, null); assert.equal(result.classes[1].start, '');
  assert.match(result.classes[1].note, /verify/); assert.ok(result.warnings.includes('An unreadable subject was skipped.'));
  assert.throws(() => normalizeSchedule({ unrelated: true }));
});
test('scan endpoint enforces authentication and photo validation without saving data', async () => {
  const app = express(); app.use(express.json()); let calls = 0;
  app.use('/scan', createScheduleScanRouter({ requireAuth: (req, res, next) => { if (!req.headers['x-test-user']) return res.status(401).json({}); req.user = { id: req.headers['x-test-user'] }; next(); }, extract: async ({ prompt }) => { calls++; assert.match(prompt, /Do not guess/); return { classes: [{ name: 'Algorithms', day: 2, start: '13:00', end: '14:30', room: '201' }], warnings: [] }; } }));
  const server = app.listen(0, '127.0.0.1'); await new Promise(resolve => server.on('listening', resolve));
  const request = async (body, authorized = true) => { const response = await fetch(`http://127.0.0.1:${server.address().port}/scan`, { method: 'POST', headers: { 'Content-Type': 'application/json', ...(authorized ? { 'x-test-user': 'alexis' } : {}) }, body: JSON.stringify(body) }); return { status: response.status, data: await response.json() }; };
  try {
    assert.equal((await request({}, false)).status, 401);
    assert.equal((await request({ imageBase64: 'not a photo', mimeType: 'image/png' })).status, 400);
    assert.equal((await request({ imageBase64: Buffer.from('fake JPEG').toString('base64'), mimeType: 'image/jpeg' })).status, 400);
    assert.equal(calls, 0);
    const response = await request({ imageBase64: Buffer.from([137,80,78,71,13,10,26,10,0,0,0,0]).toString('base64'), mimeType: 'image/png' });
    assert.equal(response.status, 200); assert.equal(response.data.classes[0].name, 'Algorithms'); assert.equal(calls, 1);
  } finally { await new Promise(resolve => server.close(resolve)); }
});
