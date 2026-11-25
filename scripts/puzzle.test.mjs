import test from 'node:test';
import assert from 'node:assert/strict';
import { checkPuzzle, conflicts, validateSolution } from '../netlify/functions/_puzzle.ts';
import { solve } from './puzzle-solver.mjs';

const grid = (rows) => Object.fromEntries(rows.flatMap((row, r) => [...row].map((v, c) => [`${r},${c}`, v === '.' ? '' : v])).filter(([, v]) => v));

// Book examples (BA Practice 4B, Logic chapter)
const sudoku = { type: 'sudoku', size: 4, givens: grid(['1...', '.2..', '...3', '.41.']) };
const minesweeper = { type: 'minesweeper', rows: 4, cols: 4, clues: { '0,0': 3, '0,2': 4, '2,1': 2, '2,3': 1 } };
const hive = { type: 'hive', max: 7, hexes: [[0, 1], [0, 3], [1, 0], [1, 2], [1, 4]], givens: { 0: '2', 1: '4' } };
const tents = { type: 'tents', rows: 4, cols: 4, trees: ['2,0', '2,2', '3,1', '3,2'] };
const timesout = { type: 'timesout', size: 3, digits: 6, rowClues: [2, null, 24], colClues: [10, 18, null] };
const sumdoku = { type: 'sumdoku', size: 4, givens: {}, cages: [
  { cells: ['0,0', '1,0', '2,0', '3,0', '3,1'], sum: 13 }, { cells: ['0,1', '1,1', '2,1', '1,2', '2,2', '2,3'], sum: 17 },
  { cells: ['0,2', '0,3', '1,3'], sum: 5 }, { cells: ['3,2', '3,3'], sum: 5 } ] };

test('sudoku example: one solution, the one in the book', () => {
  const s = solve(sudoku);
  assert.equal(s.length, 1);
  assert.deepEqual({ ...sudoku.givens, ...s[0] }, grid(['1324', '4231', '2143', '3412']));
  assert.equal(checkPuzzle(sudoku, s[0], s[0]), true);
  assert.equal(checkPuzzle(sudoku, s[0], { ...s[0], '0,1': '2' }), false);
});
test('minesweeper example: mines match the book', () => {
  const s = solve(minesweeper);
  assert.equal(s.length, 1);
  const mines = Object.keys(s[0]).filter((k) => s[0][k] === 'M').sort();
  assert.deepEqual(mines, ['0,1', '0,3', '1,0', '1,1', '1,3'].sort());
  // ✗ marks are notes only: a board with just the mines counts
  assert.equal(checkPuzzle(minesweeper, s[0], Object.fromEntries(mines.map((k) => [k, 'M']))), true);
});
test('hive example: 2 4 / 1 3 1', () => {
  const s = solve(hive);
  assert.equal(s.length, 1);
  assert.deepEqual(s[0], { 2: '1', 3: '3', 4: '1' });
});
test('tents example: four tents, none touching', () => {
  const s = solve(tents);
  assert.equal(s.length, 1);
  assert.deepEqual(Object.keys(s[0]).filter((k) => s[0][k] === 'T').sort(), ['1,0', '1,2', '3,0', '3,3'].sort());
});
test('times out example: 2 . 1 / 5 3 . / . 6 4', () => {
  const s = solve(timesout);
  assert.equal(s.length, 1);
  assert.deepEqual(Object.fromEntries(Object.entries(s[0]).filter(([, v]) => v)), grid(['2.1', '53.', '.64']));
});
test('sum-doku example matches the book', () => {
  const s = solve(sumdoku);
  assert.equal(s.length, 1);
  assert.deepEqual(s[0], grid(['3421', '4132', '1243', '2314']));
});
test('conflicts only use the rules', () => {
  assert.deepEqual([...conflicts(sudoku, { '0,1': '1' })].sort(), ['0,0', '0,1']);
  assert.equal(conflicts(sudoku, { '0,1': '3' }).size, 0);
  assert.ok(validateSolution(sudoku, { '0,1': '1' }).length > 0);
});
