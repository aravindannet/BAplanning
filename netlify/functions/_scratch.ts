// Rough-note strokes: shared by the browser (drawing, local backup) and the server (validation).
// Points are scaled 0..1 to the page width (y too, relative to width, so the page can grow downwards).

export interface Stroke {
  c: string; // colour
  w: number; // base width, in page-width units ×1000
  p: number[]; // flat list: x, y, pressure, x, y, pressure, ...
}
export interface ScratchData {
  strokes: Stroke[];
  updatedAt: number; // ms since epoch, set by the browser
}

export const MAX_BYTES = 1_000_000;
const COLORS = new Set(['#1e2a3a', '#d13b3b', '#2955a5']);
const r3 = (x: number) => Math.round(x * 1000) / 1000;

/** Drops points closer than `minDist` (page units) to the last kept point, so long strokes stay small. */
export function thin(p: number[], minDist = 0.002): number[] {
  if (p.length <= 6) return p.map(r3);
  const out = [r3(p[0]), r3(p[1]), r3(p[2])];
  for (let i = 3; i < p.length; i += 3) {
    const last = out.length - 3;
    const dx = p[i] - out[last], dy = p[i + 1] - out[last + 1];
    const end = i === p.length - 3;
    if (end || dx * dx + dy * dy >= minDist * minDist) out.push(r3(p[i]), r3(p[i + 1]), r3(p[i + 2]));
  }
  return out;
}

/** Cleans untrusted strokes: known colours, sane widths, finite numbers in range, rounded. Null if too big or malformed. */
export function sanitize(data: unknown): ScratchData | null {
  if (!data || typeof data !== 'object') return null;
  const d = data as { strokes?: unknown; updatedAt?: unknown };
  if (!Array.isArray(d.strokes) || typeof d.updatedAt !== 'number' || !Number.isFinite(d.updatedAt)) return null;
  const strokes: Stroke[] = [];
  for (const s of d.strokes) {
    if (!s || typeof s !== 'object') return null;
    const { c, w, p } = s as Stroke;
    if (!COLORS.has(c) || typeof w !== 'number' || !(w > 0 && w <= 20) || !Array.isArray(p) || p.length < 3 || p.length % 3) return null;
    if (!p.every((v) => typeof v === 'number' && Number.isFinite(v) && v >= -0.05 && v <= 5)) return null;
    strokes.push({ c, w: r3(w), p: p.map(r3) });
  }
  const out = { strokes, updatedAt: Math.round(d.updatedAt) };
  return JSON.stringify(out).length <= MAX_BYTES ? out : null;
}

/** Of two copies, the one to keep: the newer one (ties keep the first). */
export const newer = (a: ScratchData | null, b: ScratchData | null): ScratchData | null => (!a ? b : !b ? a : b.updatedAt > a.updatedAt ? b : a);
