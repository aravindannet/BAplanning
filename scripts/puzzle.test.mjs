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

// ---- Chapter 8: Fraction-Sum Link, Constellations, Maze Escape (book worked examples, BA Practice 4C) ----
import { fracOf } from '../netlify/functions/_puzzle.ts';

test('fractions and mixed numbers parse exactly', () => {
  assert.deepEqual(fracOf('1 3/7'), [10, 7]);
  assert.deepEqual(fracOf('22/7'), [22, 7]);
  assert.deepEqual(fracOf('5'), [5, 1]);
});

// a small Fraction-Sum Link board, target 1: 1/4 + 3/4 across the top, 1/3 + 2/3 across the bottom
const link = { type: 'sumlink', rows: 3, cols: 3, target: 1, nums: { '0,0': '1/4', '0,2': '3/4', '2,0': '1/3', '2,2': '2/3' } };
const linkPath = (id, ks) => Object.fromEntries(ks.map((k, i) => [k, `${id}${i}`]));
test('sum link: pairs must add to the target and paths may not jump or pass through numbers', () => {
  const good = { ...linkPath('A', ['0,0', '0,1', '0,2']), ...linkPath('B', ['2,0', '2,1', '2,2']) };
  assert.deepEqual(validateSolution(link, good), []);
  assert.equal(checkPuzzle(link, good, good), true);
  assert.ok(validateSolution(link, { ...linkPath('A', ['0,0', '1,0', '2,0']), ...linkPath('B', ['0,2', '1,2', '2,2']) }).some((e) => e.includes('is not 1')));
  assert.ok(validateSolution(link, { ...linkPath('A', ['0,0', '0,2']), ...linkPath('B', ['2,0', '2,1', '2,2']) }).some((e) => e.includes('jumps')));
  assert.ok(validateSolution(link, linkPath('A', ['2,0', '1,0', '0,0', '0,1', '0,2'])).some((e) => e.includes('through a number')));
  assert.ok(validateSolution(link, linkPath('A', ['0,0', '0,1', '0,2'])).some((e) => e.includes('not connected')));
  assert.equal(checkPuzzle(link, {}, {}), false);
});

// the example on page 58: 1 4/3 = 7/3 = 2 1/3 and 8/3 = 1 5/3 = 2 2/3
const star = { type: 'constellation', dots: [{ x: 0, y: 0, v: '7/3' }, { x: 2, y: 1, v: '2 1/3' }, { x: 3, y: 1, v: '2 2/3' }, { x: 1, y: 2, v: '8/3' }, { x: 0, y: 3, v: '1 4/3' }, { x: 2, y: 3, v: '1 5/3' }] };
test('constellation: one path per equal group, no crossings, no line through a dot', () => {
  const book = { '0-4': '1', '0-1': '1', '3-5': '1', '2-5': '1' }; // 1 4/3 - 7/3 - 2 1/3, and 8/3 - 1 5/3 - 2 2/3
  assert.deepEqual(validateSolution(star, book), []);
  assert.equal(checkPuzzle(star, book, book), true);
  assert.ok(validateSolution(star, { ...book, '1-3': '1' }).some((e) => e.includes('not equal')));
  const through = { "0-4": "1", "1-4": "1", "3-5": "1", "2-5": "1" }; // 2 1/3 - 1 4/3 runs through the 8/3 dot
  assert.ok(validateSolution(star, through).some((e) => e.includes("passes through")));
  assert.deepEqual([...conflicts(star, through)], ["1-4"], "a line through a dot glows red");
  const x = { type: "constellation", dots: [{ x: 0, y: 0, v: "1/2" }, { x: 2, y: 2, v: "2/4" }, { x: 0, y: 2, v: "1/3" }, { x: 2, y: 0, v: "2/6" }] };
  const crossed = { "0-1": "1", "2-3": "1" };
  assert.ok(validateSolution(x, crossed).some((e) => e.includes("cross")));
  assert.equal(conflicts(x, crossed).size, 2, "both crossing lines glow red");
  assert.equal(conflicts(star, { '0-1': '1', '3-5': '1' }).size, 0, 'unequal or unfinished groups are not shown in red');
});

// the example on page 52: start at 1/8, add 4/8 each move, exit above 29/8
const maze = { type: 'maze', nums: [['7/8', '16/8', '29/8', '27/8'], ['5/8', '1/8', '25/8', '21/8'], ['3/8', '1/8', '15/8', '17/8'], ['6/8', '5/8', '9/8', '13/8']], start: '2,1', exit: '0,2', exitSide: 'top' };
const mazeOf = (ks) => Object.fromEntries(ks.map((k, i) => [k, String(i + 1)]));
test('maze: skip-count by the same amount from the start to the exit', () => {
  const book = mazeOf(['2,1', '3,1', '3,2', '3,3', '2,3', '1,3', '1,2', '0,2']); // 1/8, 5/8, 9/8 ... 29/8
  assert.deepEqual(validateSolution(maze, book), []);
  assert.ok(validateSolution(maze, mazeOf(['2,1', '2,0', '1,0'])).length > 0, 'a path that stops short is wrong');
  assert.ok(validateSolution(maze, mazeOf(['2,1', '3,1', '3,0'])).some((e) => e.includes('same skip')));
  assert.ok(validateSolution(maze, mazeOf(['3,1', '3,2'])).some((e) => e.includes('begin at the start')));
});
