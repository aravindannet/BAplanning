// Number-pad typing (pure, so it can be unit-tested).

/** Applies a pad key to `text` at the caret. Spaced symbols get spaces around them; erase removes a whole symbol. */
export function applyKey(text: string, caret: number, k: string): { text: string; caret: number } {
  const before = text.slice(0, caret), after = text.slice(caret);
  if (k === '⌫') {
    const b = before.replace(/\s*\S\s*$/, '');
    return { text: b + after, caret: b.length };
  }
  const ins = k === ',' ? ', ' : ['÷', '=', '&'].includes(k) ? ` ${k} ` : k;
  const b = (ins.startsWith(' ') ? before.replace(/\s+$/, '') : before) + ins;
  return { text: b + after, caret: b.length };
}
