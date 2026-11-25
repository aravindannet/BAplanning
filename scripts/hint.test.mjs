import test from 'node:test';
import assert from 'node:assert/strict';
import { hintProblem } from '../netlify/functions/_hintRules.ts';

const p = { prompt: 'School buses can hold up to 25 monsters. How many buses are needed to take 785 students?', parts: [{ label: 'answer', answer: '35', accepted: [] }] };
test('a question about the idea passes', () => {
  assert.equal(hintProblem('After the buses are full, is anyone still waiting at school?', p, '34'), null);
});
test('naming an operation is rejected', () => {
  assert.match(hintProblem('Try to divide 785 by 25 again.', p, '34'), /operation/);
  assert.match(hintProblem('Did you multiply carefully?', p, '34'), /operation/);
});
test('numbers from the working are rejected; numbers in the problem or the answer are fine', () => {
  assert.match(hintProblem('Each bus has room for 23 students.', p, '34'), /number/);
  assert.equal(hintProblem('With 25 seats on a bus and 785 students, did your 34 buses carry everyone?', p, '34'), null);
});
test('the answer is never allowed', () => {
  const q = { prompt: 'How many pairs?', parts: [{ label: 'answer', answer: '1326', accepted: [] }] };
  assert.match(hintProblem('Is it 1,326?', q, '2652'), /number|answer/);
});
test('a hint that talks about itself or apologises is rejected', () => {
  const p = { prompt: 'Find the factors in the 2 by 3 times table.', parts: [{ answer: '9' }] };
  assert.match(hintProblem("You're right, that hint named an operation, which I shouldn't have done. Look at the 60.", p, ''), /talked about/);
  assert.match(hintProblem('Sorry! Think about the first row.', p, ''), /talked about/);
  assert.match(hintProblem('My last hint was too much. Which primes are in every product?', p, ''), /talked about/);
  assert.equal(hintProblem("What do the puzzle's rules say about each row? Which primes appear in every product there?", p, ''), null);
});
test('"multiply" is allowed in multiplication puzzles, but other operations and other problems are not', () => {
  const tt = { prompt: 'Times Table puzzle: fill in the factors. Products: 60, 32, 72.', parts: [], puzzle: { type: 'timestable' } };
  assert.equal(hintProblem('Which numbers multiply to make 60? Which of them also fits the other box in that row?', tt, ''), null);
  assert.equal(hintProblem('Factor Blob: what do you get when you multiply the numbers in your blob?', { ...tt, puzzle: { type: 'blobs' } }, ''), null);
  assert.match(hintProblem('Multiply first, then divide 60 by the row factor.', tt, ''), /operation to do \("divide"\)/);
  assert.match(hintProblem('Did you multiply carefully?', { prompt: 'A bus holds 23.', parts: [{ answer: '34' }] }, '34'), /operation/);
  assert.match(hintProblem('Did you multiply carefully?', { prompt: 'Sudoku: fill the grid so each row, column and box has 1 to 4.', parts: [], puzzle: { type: 'sudoku' } }, ''), /operation/);
});
test('an operation the problem itself shows may be named; a hidden one may not', () => {
  const div = { prompt: 'Find the quotient without long division: 32,600 ÷ 50 = ?', parts: [{ answer: '652' }] };
  assert.equal(hintProblem('What happens to 32,600 when you think of dividing by 50 as two smaller steps?', div, '111'), null);
  assert.match(hintProblem('What if you multiply first?', div, '111'), /operation to do \("multiply"\)/);
  // the bus problem never says "divide": naming it still gives the step away
  assert.match(hintProblem('Try to divide 785 by 25 again.', p, '34'), /operation/);
});
test('the next hint is told what was already said and tried', async () => {
  const { contextText } = await import('../netlify/functions/_hintRules.ts');
  assert.equal(contextText({}), '');
  const t = contextText({ earlierHints: [{ hint: '3×3 is a factor of 72, but not of 32.', hintFrom: 'book' }, { hint: 'Which primes are in every product?' }], earlierAnswers: ['9', '12'] });
  assert.match(t, /earlier wrong answers[\s\S]*1\. 9\n2\. 12/);
  assert.match(t, /1\. \(from the book\) 3×3 is a factor/);
  assert.match(t, /2\. Which primes/);
  assert.match(t, /Do not repeat these hints/);
  assert.match(t, /Do not refer to them/);
});
