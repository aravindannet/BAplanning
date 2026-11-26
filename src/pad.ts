// Number-pad typing (pure, so it can be unit-tested).

/** A fraction answer typed into three boxes: whole number, top (numerator), bottom (denominator). */
export type FracBoxes = { w: string; n: string; d: string };
export const EMPTY_FRAC: FracBoxes = { w: '', n: '', d: '' };

/** Answers whose only pad symbol is "/" (a fraction or mixed number) get the fraction boxes. */
export const isFracPad = (keys?: string[] | null) => !!keys && keys.length === 1 && keys[0] === '/';

/** The answer text the boxes make: "2 3/4", "3/4", "5"; "" while the fraction is half typed. */
export function fracText(b: FracBoxes): string {
  const w = b.w.trim(), n = b.n.trim(), d = b.d.trim();
  if (!n && !d) return w;
  if (!n || !d) return '';
  return w ? `${w} ${n}/${d}` : `${n}/${d}`;
}

/** The boxes for an answer text (the reverse of fracText; used by tests). */
export function fracBoxes(text: string): FracBoxes {
  const m = text.trim().match(/^(?:(\d+)\s+)?(\d+)\/(\d+)$/);
  if (m) return { w: m[1] ?? '', n: m[2], d: m[3] };
  return { w: text.trim(), n: '', d: '' };
}

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
