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
