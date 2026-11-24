import test from 'node:test';
import assert from 'node:assert/strict';
import { addExtraPractice } from './gaps.mjs';

const box = (id, book, pages, from, to) => ({ id, title: id, tasks: [{ id: id + '-practice', type: 'practice', book, pages, problems: Array.from({ length: to - from + 1 }, (_, i) => ({ n: from + i, optional: false })) }] });

test('fills a gap after the preceding box and infers the pages', () => {
  const ch = { number: 4, boxes: [box('a', '4B', [32, 33], 87, 90), box('b', '4B', [36, 37], 98, 106)] };
  addExtraPractice(4, ch);
  assert.deepEqual(ch.boxes.map((b) => b.id), ['a', '4-c4-x1', 'b']);
  const t = ch.boxes[1].tasks[0];
  assert.deepEqual(t.problems.map((p) => p.n), [91, 92, 93, 94, 95, 96, 97]);
  assert.deepEqual(t.pages, [34, 35]);
  assert.equal(ch.boxes[1].extra, true);
});

test('leaves pages out when they cannot be inferred', () => {
  const ch = { number: 1, boxes: [box('a', '4A', [32, 33], 1, 5), box('b', '4A', [34, 35], 8, 9)] };
  addExtraPractice(4, ch);
  assert.equal(ch.boxes[1].tasks[0].pages, undefined);
  assert.deepEqual(ch.boxes[1].tasks[0].problems.map((p) => p.n), [6, 7]);
});

test('no gap, no extra box; existing ids untouched', () => {
  const ch = { number: 1, boxes: [box('a', '4A', [1], 1, 5), box('b', '4A', [2], 6, 9)] };
  addExtraPractice(4, ch);
  assert.deepEqual(ch.boxes.map((b) => b.id), ['a', 'b']);
});

test('handles two gaps in one chapter', () => {
  const ch = { number: 5, boxes: [box('a', '5B', [10], 1, 5), box('b', '5B', [20], 10, 12), box('c', '5B', [30], 20, 22)] };
  addExtraPractice(5, ch);
  assert.deepEqual(ch.boxes.map((b) => b.id), ['a', '5-c5-x1', 'b', '5-c5-x2', 'c']);
});
