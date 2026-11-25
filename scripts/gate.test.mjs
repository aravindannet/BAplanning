import test from 'node:test';
import assert from 'node:assert/strict';
import { gateTask } from '../netlify/functions/_gate.ts';

const task = { id: 't', type: 'practice', pages: [42], problems: [{ n: 1, optional: false }, { n: 2, optional: false }, { n: 3, optional: true }, { n: 4, optional: false }] };
const base = { available: new Set([1, 2, 3, 4]), solved: new Set(), learnPages: new Set([42]), learned: false };
const reasons = (g) => Object.fromEntries([...gateTask(task, g)].map(([n, r]) => [n, r.reason + (r.need ?? '')]));

test('learn gates everything until finished', () => {
  assert.deepEqual(reasons(base), { 1: 'learn', 2: 'learn', 3: 'learn', 4: 'learn' });
});
test('after learn only the first problem is open', () => {
  assert.deepEqual(reasons({ ...base, learned: true }), { 2: 'previous1', 3: 'previous1', 4: 'previous1' });
});
test('solving opens the next; optional never blocks', () => {
  assert.deepEqual(reasons({ ...base, learned: true, solved: new Set([1]) }), { 3: 'previous2', 4: 'previous2' });
  // 2 solved, 3 (dashed) skipped -> 4 is open
  assert.deepEqual(reasons({ ...base, learned: true, solved: new Set([1, 2]) }), {});
});
test('a task with no Learn page has no learn gate', () => {
  assert.deepEqual(Object.fromEntries([...gateTask(task, { ...base, learnPages: new Set() })].map(([n, r]) => [n, r.reason])), { 2: 'previous', 3: 'previous', 4: 'previous' });
});
test('unscanned problems neither lock nor block', () => {
  const g = { ...base, learned: true, available: new Set([2, 4]) };
  assert.deepEqual(reasons(g), { 4: 'previous2' });
});

import { starsFor, firstRequiredUnsolved } from '../netlify/functions/_gate.ts';

test('an earlier box that is not finished locks the whole task (box rule beats learn)', () => {
  assert.deepEqual(reasons({ ...base, learned: true, blockedBy: 17 }), { 1: 'box17', 2: 'box17', 3: 'box17', 4: 'box17' });
  assert.deepEqual(reasons({ ...base, blockedBy: 17 }), { 1: 'box17', 2: 'box17', 3: 'box17', 4: 'box17' });
  // already-solved problems stay open
  assert.deepEqual(reasons({ ...base, learned: true, blockedBy: 17, solved: new Set([1]) }), { 2: 'box17', 3: 'box17', 4: 'box17' });
});
test('firstRequiredUnsolved skips dashed, unscanned and solved problems', () => {
  assert.equal(firstRequiredUnsolved(task, base.available, new Set()), 1);
  assert.equal(firstRequiredUnsolved(task, base.available, new Set([1, 2])), 4);
  assert.equal(firstRequiredUnsolved(task, new Set([3]), new Set()), null);
  assert.equal(firstRequiredUnsolved(task, base.available, new Set([1, 2, 4])), null);
});
test('stars: 0-1 wrong = 3, 2 wrong = 2, 3+ wrong = 1', () => {
  assert.equal(starsFor(0), 3);
  assert.equal(starsFor(1), 3);
  assert.equal(starsFor(2), 2);
  assert.equal(starsFor(3), 1);
  assert.equal(starsFor(7), 1);
});
