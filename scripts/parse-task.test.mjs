import test from 'node:test';
import assert from 'node:assert/strict';
import { parseTask } from './parse-task.mjs';

test('guide: pages and topic', () => {
  const t = parseTask('x', 'guide', '4A pg. 14-18 (R&G)');
  assert.equal(t.book, '4A');
  assert.deepEqual(t.pages, [14, 15, 16, 17, 18]);
  assert.equal(t.topic, 'R&G');
});

test('practice: page list, ranges and optional problems', () => {
  const t = parseTask('x', 'practice', '4A pg. 11, 13 (#27-36 and #43-46, with #33-36 optional)');
  assert.deepEqual(t.pages, [11, 13]);
  assert.equal(t.problems.length, 14);
  assert.deepEqual(t.problems.filter((p) => p.optional).map((p) => p.n), [33, 34, 35, 36]);
});

test('practice: single page, no optional', () => {
  const t = parseTask('x', 'practice', '4A pg. 7 (#1-11)');
  assert.deepEqual(t.pages, [7]);
  assert.equal(t.problems.length, 11);
  assert.ok(t.problems.every((p) => !p.optional));
});

test('practice: tolerates the PDF typo "9#81-92"', () => {
  const t = parseTask('x', 'practice', '4A pg. 22-23 9#81-92, with #86 optional)');
  assert.deepEqual(t.pages, [22, 23]);
  assert.equal(t.problems.length, 12);
  assert.deepEqual(t.problems.filter((p) => p.optional).map((p) => p.n), [86]);
});

test('online keeps text verbatim', () => {
  assert.equal(parseTask('x', 'online', 'Angle Sense, Using a Protractor').text, 'Angle Sense, Using a Protractor');
});

test('unparseable practice falls back to raw text', () => {
  const t = parseTask('x', 'practice', 'See your workbook');
  assert.equal(t.text, 'See your workbook');
  assert.equal(t.pages, undefined);
});
