// Every problem of the interactive chapters: the right answer is marked right, wrong answers are marked
// wrong, and every puzzle's stored solution obeys the puzzle's own rules. Needs the git-ignored
// problem-data (each chapter is skipped if its file is absent).
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { checkAnswer } from '../netlify/functions/_answer.ts';
import { checkPuzzle, editableCells, validateSolution } from '../netlify/functions/_puzzle.ts';

const CHAPTERS = [['ba4-c6.mjs', 120], ['ba4-c7.mjs', 147]];

for (const [name, count] of CHAPTERS) {
  const file = new URL(`../problem-data/${name}`, import.meta.url);
  const have = fs.existsSync(file);
  const probs = have ? (await import(file.href)).default : [];
  test(`${name}: has all ${count} problems`, { skip: !have }, () => {
    assert.deepEqual(probs.map((p) => p.n), [...Array(count)].map((_, i) => i + 1));
  });
  for (const p of probs) {
    test(`${name} problem ${p.n}: right answer is right, wrong answer is wrong`, () => {
      if (p.kind === 'explain') {
        assert.ok(p.solution.length > 40, 'explain problems need a solution for the AI judge');
        return;
      }
      for (const part of p.parts) {
        const acc = [part.answer, ...part.accepted];
        assert.ok(checkAnswer(part.answer, acc), `part ${part.label}: "${part.answer}" should be right`);
        for (const a of part.accepted) assert.ok(checkAnswer(a, acc), `part ${part.label}: accepted "${a}" should be right`);
        if (part.choices && part.multi) {
          const right = part.answer.split(', ');
          // the joined picks the app sends are exactly the answer; one pick fewer or one wrong pick is wrong
          assert.ok(checkAnswer(part.choices.filter((c) => right.includes(c)).join(', '), acc), `part ${part.label}: the picks in button order should be right`);
          if (right.length > 1) assert.ok(!checkAnswer(right.slice(1).join(', '), acc), `part ${part.label}: missing a pick should be wrong`);
          const extra = part.choices.find((c) => !right.includes(c));
          if (extra) assert.ok(!checkAnswer([...right, extra].join(', '), acc), `part ${part.label}: an extra pick should be wrong`);
        } else if (part.choices) {
          assert.ok(part.choices.includes(part.answer), `part ${part.label}: answer must be one of the buttons`);
          for (const c of part.choices) if (c !== part.answer) assert.ok(!checkAnswer(c, acc), `part ${part.label}: "${c}" should be wrong`);
        } else {
          assert.ok(!checkAnswer('999', acc), `part ${part.label}: 999 should be wrong`);
        }
      }
      if (p.puzzle && p.puzzle.type !== 'logicgrid') {
        const sol = p.puzzleSolution;
        assert.ok(sol && Object.keys(sol).length, 'puzzle needs a stored solution');
        assert.equal(checkPuzzle(p.puzzle, sol, sol), true, 'the solution board must be accepted');
        const partial = p.puzzle.type === 'sudoku' && (p.puzzle.ask?.length || p.puzzle.fill?.length);
        if (!partial) assert.deepEqual(validateSolution(p.puzzle, sol), [], 'solution must obey every rule');
        const asked = p.puzzle.ask ?? [];
        const k = Object.keys(sol).find((x) => ['M', 'T', 'P', 'O'].includes(sol[x]) || (asked.length ? asked.includes(x) : sol[x] && sol[x] !== 'X'));
        const flip = { M: 'X', T: 'X', P: '', O: 'X' };
        const wrong = { ...sol, [k]: sol[k] in flip ? flip[sol[k]] : p.puzzle.type === 'blobs' ? '' : sol[k] === '1' ? '2' : '1' };
        assert.equal(checkPuzzle(p.puzzle, sol, wrong), false, 'a changed board must be rejected');
        assert.equal(checkPuzzle(p.puzzle, sol, {}), false, 'an empty board must be rejected');
        assert.ok(editableCells(p.puzzle).length > 0, 'the kid must have squares to fill');
      }
    });
  }
}
