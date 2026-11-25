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
