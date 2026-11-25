import test from 'node:test';
import assert from 'node:assert/strict';
import { checkAnswer } from '../netlify/functions/_answer.ts';

test('numbers, fractions, decimals', () => {
  assert.ok(checkAnswer('0.5', ['1/2']));
  assert.ok(checkAnswer('.5', ['1/2']));
  assert.ok(checkAnswer('1 1/2', ['3/2']));
  assert.ok(checkAnswer(' 42 ', ['42']));
  assert.ok(checkAnswer('1,200', ['1200']));
  assert.ok(!checkAnswer('43', ['42']));
  assert.ok(!checkAnswer('', ['0']));
});
test('units, variable prefix, money', () => {
  assert.ok(checkAnswer('x = 5', ['5']));
  assert.ok(checkAnswer('12 square units', ['12']));
  assert.ok(checkAnswer('$3.50', ['3.5']));
});
test('remainders', () => {
  assert.ok(checkAnswer('3 r 2', ['3R2']));
  assert.ok(!checkAnswer('3 r 1', ['3R2']));
});
test('unordered lists', () => {
  assert.ok(checkAnswer('3, 2', ['2, 3']));
  assert.ok(checkAnswer('3 and 2', ['2,3']));
  assert.ok(!checkAnswer('2', ['2, 3']));
});
test('text answers', () => {
  assert.ok(checkAnswer('Odd', ['odd']));
});
test('unit-like variable answers and thousands commas in lists', () => {
  assert.ok(checkAnswer('m', ['m']));
  assert.ok(!checkAnswer('g', ['m']));
  assert.ok(checkAnswer('10,025 and 1,400', ['10025, 1400']));
  assert.ok(checkAnswer('1400 10025', ['10025, 1400']));
});
test('equations accept / for ÷ and x for ×', () => {
  assert.ok(checkAnswer('42/7=6', ['42 ÷ 7 = 6']));
  assert.ok(checkAnswer('42 ÷ 7 = 6', ['42 ÷ 7 = 6']));
  assert.ok(checkAnswer('6x7=42', ['6 × 7 = 42']));
  assert.ok(!checkAnswer('42/6=7', ['42 ÷ 7 = 6']));
  assert.ok(checkAnswer('1/2', ['0.5']));
});

test('a number followed by words matches a numeric answer', () => {
  assert.equal(checkAnswer('55 pairs', ['55']), true);
  assert.equal(checkAnswer('35 buses', ['35']), true);
  assert.equal(checkAnswer('1,326 pairs of cards', ['1326']), true);
  assert.equal(checkAnswer('34 buses', ['35']), false);
  assert.equal(checkAnswer('5 and 7', ['5']), false);
  assert.equal(checkAnswer('3 r 2', ['3']), false);
});

test('prime factorizations match in any form, but bases must be prime', () => {
  assert.equal(checkAnswer('2^2×5×7', ['2²×5×7']), true);
  assert.equal(checkAnswer('7x5x2x2', ['2²×5×7']), true);
  assert.equal(checkAnswer('2 * 2 * 5 * 7', ['2²×5×7']), true);
  assert.equal(checkAnswer('4×5×7', ['2²×5×7']), false);
  assert.equal(checkAnswer('140', ['2²×5×7']), false);
  assert.equal(checkAnswer('2^3×5×7', ['2²×5×7']), false);
  assert.equal(checkAnswer('113', ['113']), true);
});

test('factor-pair lists match in any order and either way round', () => {
  assert.equal(checkAnswer('30x1, 15x2, 3x10, 5x6', ['1×30, 2×15, 3×10, 5×6']), true);
  assert.equal(checkAnswer('1×30, 2×15, 3×10', ['1×30, 2×15, 3×10, 5×6']), false);
  assert.equal(checkAnswer('31 & 13, 17 & 71, 37 and 73, 97 & 79', ['13 & 31, 17 & 71, 37 & 73, 79 & 97']), true);
  assert.equal(checkAnswer('1, 30, 2, 15', ['1×30, 2×15']), false);
});
