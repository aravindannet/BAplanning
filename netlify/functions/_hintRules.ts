// Checks a generated hint against the hint rules (pure, no imports, so it can be unit-tested).
const numbersIn = (t: string) => new Set(t.replace(/(\d),(?=\d{3}(?!\d))/g, '$1').match(/\d+(?:\.\d+)?/g) ?? []);
const OP_WORDS = /\b(divid\w*|subtract\w*|multipl\w*|add|adding|minus)\b/gi;
// puzzles that are all about multiplying: saying "multiply" there names the puzzle, not a step
const MULTIPLY_PUZZLES = new Set(['timestable', 'blobs', 'pyramid']);

/**
 * Why a hint breaks the rules, or null if it's fine: it must not name an operation to do, must not bring in a
 * number from the solution's working (only numbers from the problem or the child's answer), and must not
 * contain the answer.
 */
const META = /\b(that|this|my|previous|earlier|last|the) hint\b|\bI (shouldn't|should not|should have|apologi[sz]e|made)|^\s*(you're right|sorry|my mistake|apologies)/i;

export function hintProblem(hint: string, p: { prompt: string; parts: { answer: string }[]; puzzle?: { type: string } }, wrongAnswer: string): string | null {
  if (!hint) return 'it was empty';
  // the child must only see a hint, never the model talking about hints, rules or itself
  if (META.test(hint)) return 'it talked about the hint or the rules instead of just giving the hint';
  const okMultiply = MULTIPLY_PUZZLES.has(p.puzzle?.type ?? '');
  const op = [...hint.matchAll(OP_WORDS)].find((m) => !(okMultiply && /^multipl/i.test(m[0])));
  if (op) return `it told the child which operation to do ("${op[0]}")`;
  const allowed = new Set([...numbersIn(p.prompt), ...numbersIn(wrongAnswer), '0', '1', '2']);
  const extra = [...numbersIn(hint)].filter((n) => !allowed.has(n));
  if (extra.length) return `it used a number that is not in the problem or the child's answer (${extra.join(', ')})`;
  // never leak the answer: whole-token match ("70" must not trip on "700"), answers of 3+ characters only
  for (const part of p.parts) {
    const a = part.answer.trim();
    if (a.length < 3) continue;
    const esc = a.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    if (new RegExp(`(?<![\\w.,])${esc}(?![\\w]|[.,]\\d)`, 'i').test(hint)) return 'it gave away the answer';
  }
  return null;
}

