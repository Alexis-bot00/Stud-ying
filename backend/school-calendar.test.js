import { test } from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import multer from 'multer';
import os from 'node:os';
import fs from 'node:fs/promises';
import { createSchoolCalendarRouter, normalizeActivities } from './school-calendar.js';

test('calendar preserves ranges across years, skips duplicates and flags invalid dates for review', () => {
  const row = { title: 'Winter break', start: '2026-12-20', end: '2027-01-05' };
  const result = normalizeActivities({ activities: [row, row, { title: 'Exam', start: '2027-02-30' }, { title: 'Unknown day' }, { title: '' }] });
  assert.equal(result.activities.length, 3);
  assert.equal(result.activities[0].end, '2027-01-05');
  assert.equal(result.activities[1].start, '');
  assert.equal(result.activities[2].start, '');
});
test('calendar upload requires sign-in, extracts a document and cleans up its temporary file', async () => {
  const app = express(); let temporaryPath; let calls = 0;
  app.use('/calendar', createSchoolCalendarRouter({
    requireAuth: (req, res, next) => { if (!req.headers['x-user']) return res.sendStatus(401); req.user = { id: req.headers['x-user'] }; next(); },
    upload: multer({ dest: os.tmpdir() }),
    extractText: async path => { temporaryPath = path; return fs.readFile(path, 'utf8'); },
    extractActivities: async prompt => { calls++; assert.match(prompt, /2026/); assert.match(prompt, /Graduation/); return { activities: [{ title: 'Graduation', start: '2027-04-15', end: '2027-04-15' }] }; },
  }));
  const server = app.listen(0, '127.0.0.1'); await new Promise(resolve => server.once('listening', resolve));
  try {
    const url = `http://127.0.0.1:${server.address().port}/calendar`;
    assert.equal((await fetch(url, { method: 'POST' })).status, 401);
    const form = new FormData(); form.append('year', '2026'); form.append('file', new Blob(['Graduation April 15, 2027'], { type: 'text/plain' }), 'calendar.txt');
    const response = await fetch(url, { method: 'POST', headers: { 'x-user': 'student' }, body: form });
    assert.equal(response.status, 200); assert.equal((await response.json()).activities[0].start, '2027-04-15'); assert.equal(calls, 1);
    for (let i = 0; i < 20; i++) { try { await fs.access(temporaryPath); await new Promise(resolve => setTimeout(resolve, 10)); } catch { break; } }
    await assert.rejects(fs.access(temporaryPath));
  } finally { await new Promise(resolve => server.close(resolve)); }
});
