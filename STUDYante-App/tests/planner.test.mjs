import { test } from 'node:test';
import assert from 'node:assert/strict';
import { emptyPlanner, validDate, validTime, grade, streak, reminderDates, mergeClasses } from '../src/components/cappy-model.ts';
test('dates and class times reject invalid entries', () => {
  assert.equal(validDate('2026-02-30'), false); assert.equal(validDate('2028-02-29'), true);
  assert.equal(validTime('24:00'), false); assert.equal(validTime('09:30'), true);
});
test('grade estimates use earned and possible points', () => {
  assert.equal(grade({ scores: [] }), null);
  assert.equal(grade({ scores: [{ earned: 18, total: 20 }, { earned: 27, total: 30 }] }), 90);
});
test('attendance streak survives an unchecked current day but resets after a gap', () => {
  const now = new Date(2026, 9, 3, 12);
  assert.equal(streak(['2026-10-01', '2026-10-02'], now), 2);
  assert.equal(streak(['2026-10-01'], now), 0);
  assert.equal(streak(['2026-10-01', '2026-10-02', '2026-10-03'], now), 3);
});
test('reminders respect no-class exceptions and omit expired alerts', () => {
  const classes = [{ id: 'math', name: 'Math', day: 6, start: '09:00' }];
  const planner = { ...emptyPlanner, classes, notifyAt: true, notifyBefore: true, minutes: 15, noClass: ['2026-10-10'] };
  const results = reminderDates(classes, planner, new Date(2026, 9, 3, 8, 50));
  assert.equal(results.filter(r => r.date.getDate() === 3).length, 1);
  assert.equal(results.some(r => r.date.getDate() === 10), false);
  assert.equal(results.filter(r => r.date.getDate() === 17).length, 2);
});
test('photo import preserves existing classes and skips duplicate meetings', () => {
  const existing = [{ id: 'first', name: 'Math', day: 1, start: '09:00', end: '10:00', room: '' }];
  const rows = [{ ...existing[0], id: 'new', name: 'math' }, { id: 'biology', name: 'Biology', day: 3, start: '13:00', end: '14:00', room: '201' }];
  const merged = mergeClasses(existing, rows);
  assert.equal(merged.length, 2); assert.equal(merged[0].id, 'first'); assert.equal(merged[1].name, 'Biology');
});
