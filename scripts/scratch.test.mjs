import test from 'node:test';
import assert from 'node:assert/strict';
import { MAX_BYTES, newer, sanitize, thin } from '../netlify/functions/_scratch.ts';

test('thinning keeps the ends and drops points that barely move', () => {
  const p = [];
  for (let i = 0; i <= 100; i++) p.push(0.1 + i * 0.0001, 0.2, 0.5); // 101 points 0.0001 apart
  const t = thin(p);
  assert.ok(t.length / 3 < 10, `kept ${t.length / 3} points`);
  assert.deepEqual(t.slice(0, 2), [0.1, 0.2]);
  assert.deepEqual(t.slice(-3, -1), [0.11, 0.2]);
});
test('sanitize accepts good strokes and rounds them', () => {
  const d = sanitize({ updatedAt: 5, strokes: [{ c: '#1e2a3a', w: 2.2, p: [0.12345, 0.5, 0.5] }] });
  assert.deepEqual(d, { updatedAt: 5, strokes: [{ c: '#1e2a3a', w: 2.2, p: [0.123, 0.5, 0.5] }] });
});
test('sanitize rejects bad colours, widths, numbers, and oversized pages', () => {
  assert.equal(sanitize({ updatedAt: 1, strokes: [{ c: 'url(x)', w: 2, p: [0, 0, 0] }] }), null);
  assert.equal(sanitize({ updatedAt: 1, strokes: [{ c: '#1e2a3a', w: 999, p: [0, 0, 0] }] }), null);
  assert.equal(sanitize({ updatedAt: 1, strokes: [{ c: '#1e2a3a', w: 2, p: [0, NaN, 0] }] }), null);
  assert.equal(sanitize({ updatedAt: 1, strokes: [{ c: '#1e2a3a', w: 2, p: [0, 0] }] }), null);
  assert.equal(sanitize({ strokes: [] }), null);
  const huge = { updatedAt: 1, strokes: [{ c: '#1e2a3a', w: 2, p: Array(MAX_BYTES / 2).fill(0.5) .slice(0, 3 * 100000) }] };
  assert.equal(sanitize(huge), null);
});
test('the newer copy wins', () => {
  const a = { strokes: [], updatedAt: 10 }, b = { strokes: [], updatedAt: 20 };
  assert.equal(newer(a, b), b);
  assert.equal(newer(b, a), b);
  assert.equal(newer(null, a), a);
  assert.equal(newer(a, null), a);
});
