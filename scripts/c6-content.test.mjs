// Every Chapter 6 problem: the right answer is marked right, a wrong answer is marked wrong, and every puzzle's
// stored solution obeys the puzzle's own rules. Needs the git-ignored problem-data (skips if it's absent).
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { checkAnswer } from '../netlify/functions/_answer.ts';
import { checkPuzzle, editableCells, validateSolution } from '../netlify/functions/_puzzle.ts';

const file = new URL('../problem-data/ba4-c6.mjs', import.meta.url);
const have = fs.existsSync(file);
const probs = have ? (await import(file.href)).default : [];

test('chapter 6 has all 120 problems', { skip: !have }, () => {
  assert.deepEqual(probs.map((p) => p.n), [...Array(120)].map((_, i) => i + 1));
});

for (const p of probs) {
  test(`problem ${p.n}: right answer is right, wrong answer is wrong`, () => {
    if (p.kind === 'explain') {
      assert.ok(p.solution.length > 40, 'explain problems need a solution for the AI judge');
      return;
    }
    for (const part of p.parts) {
      assert.ok(checkAnswer(part.answer, [part.answer, ...part.accepted]), `part ${part.label}: "${part.answer}" should be right`);
      if (part.choices) {
        assert.ok(part.choices.includes(part.answer), `part ${part.label}: answer must be one of the buttons`);
        for (const c of part.choices) if (c !== part.answer) assert.ok(!checkAnswer(c, [part.answer, ...part.accepted]), `part ${part.label}: "${c}" should be wrong`);
      } else {
        assert.ok(!checkAnswer('999', [part.answer, ...part.accepted]), `part ${part.label}: 999 should be wrong`);
      }
    }
    if (p.puzzle && p.puzzle.type !== 'logicgrid') {
      const sol = p.puzzleSolution;
      assert.ok(sol && Object.keys(sol).length, 'puzzle needs a stored solution');
      assert.equal(checkPuzzle(p.puzzle, sol, sol), true, 'the solution board must be accepted');
      const partial = p.puzzle.type === 'sudoku' && (p.puzzle.ask?.length || p.puzzle.fill?.length);
      if (!partial) assert.deepEqual(validateSolution(p.puzzle, sol), [], 'solution must obey every rule');
      // a board with one square changed is rejected
      // change a square that matters: a mine/tent, an asked square, or any filled square
      const asked = p.puzzle.ask ?? [];
      const k = Object.keys(sol).find((x) => (sol[x] === 'M' || sol[x] === 'T') || (asked.length ? asked.includes(x) : sol[x] && sol[x] !== 'X'));
      const wrong = { ...sol, [k]: sol[k] === 'M' || sol[k] === 'T' ? 'X' : sol[k] === '1' ? '2' : '1' };
      assert.equal(checkPuzzle(p.puzzle, sol, wrong), false, 'a changed board must be rejected');
      assert.equal(checkPuzzle(p.puzzle, sol, {}), false, 'an empty board must be rejected');
      assert.ok(editableCells(p.puzzle).length > 0, 'the kid must have squares to fill');
    }
  });
}
