// Dev tool: brute-force solver for the Logic-chapter puzzles. Used to compute (and prove unique) the
// stored solution of each transcribed puzzle, so a transcription slip shows up as 0 or 2+ solutions.
import { editableCells, conflicts, validateSolution } from '../netlify/functions/_puzzle.ts';

function options(spec) {
  switch (spec.type) {
    case 'sudoku':
    case 'sumdoku':
      return [...Array(spec.size)].map((_, i) => String(i + 1));
    case 'timesout':
      return ['', ...[...Array(spec.digits)].map((_, i) => String(i + 1))];
    case 'minesweeper':
      return ['M', 'X'];
    case 'tents':
      return ['T', 'X'];
    case 'hive':
      return [...Array(spec.max)].map((_, i) => String(i + 1));
    default:
      return [];
  }
}

/** Up to `limit` solutions (cell maps of the editable cells). */
export function solve(spec, limit = 2) {
  const open = editableCells(spec);
  const opts = options(spec);
  const found = [];
  const cells = {};
  const rec = (i) => {
    if (found.length >= limit) return;
    if (i === open.length) {
      if (validateSolution(spec, cells).length === 0) found.push({ ...cells });
      return;
    }
    for (const o of opts) {
      cells[open[i]] = o;
      const bad = conflicts(spec, cells);
      // only prune on cells already decided (and on clue cells for minesweeper)
      if (![...bad].some((k) => k in cells || spec.type === 'minesweeper')) rec(i + 1);
      delete cells[open[i]];
    }
  };
  rec(0);
  return found;
}

/**
 * The stored solution for a puzzle: the unique full solution, or for "shaded square" (`ask`) and
 * "fill in the 3's" (`fill`) sudokus, the cells that are the same in every possible completion.
 * Throws if the puzzle has no solution or the asked cells aren't forced.
 */
export function derive(spec) {
  const partial = spec.type === 'sudoku' && (spec.ask?.length || spec.fill?.length);
  const all = solve(spec, partial ? 400 : 2);
  if (!all.length) throw new Error('no solution');
  if (!partial) {
    if (all.length > 1) throw new Error('more than one solution');
    return all[0];
  }
  const out = {};
  if (spec.ask?.length) {
    for (const k of spec.ask) {
      const vals = new Set(all.map((s) => s[k]));
      if (vals.size !== 1) throw new Error(`cell ${k} is not forced: ${[...vals]}`);
      out[k] = all[0][k];
    }
  } else {
    const where = (s) => Object.keys(s).filter((k) => spec.fill.includes(s[k])).sort().map((k) => `${k}=${s[k]}`).join(' ');
    const shapes = new Set(all.map(where));
    if (shapes.size !== 1) throw new Error(`fill digits not forced: ${[...shapes].slice(0, 3).join(' | ')}`);
    for (const k of Object.keys(all[0])) if (spec.fill.includes(all[0][k])) out[k] = all[0][k];
  }
  return out;
}

// ---- Chapter 7 types ----
const k2 = (r, c) => `${r},${c}`;
const divisors = (n) => { const d = []; for (let i = 1; i <= n; i++) if (n % i === 0) d.push(i); return d; };

/** Times Table: every way to fill the factors (positive whole numbers) consistent with the given products. */
export function solveTimesTable(spec, limit = 5) {
  const { rows, cols, givens } = spec;
  const g = (r, c) => (givens[k2(r, c)] ? Number(givens[k2(r, c)]) : null);
  const out = [];
  const A = Array(rows + 1).fill(null), C = Array(cols + 1).fill(null);
  for (let r = 1; r <= rows; r++) A[r] = g(r, 0);
  for (let c = 1; c <= cols; c++) C[c] = g(0, c);
  const rec = () => {
    if (out.length >= limit) return;
    // propagate
    let changed = true;
    const sa = [...A], sc = [...C];
    while (changed) {
      changed = false;
      for (let r = 1; r <= rows; r++) for (let c = 1; c <= cols; c++) {
        const p = g(r, c);
        if (p == null) continue;
        if (A[r] && !C[c]) { if (p % A[r]) return restore(sa, sc); C[c] = p / A[r]; changed = true; }
        else if (C[c] && !A[r]) { if (p % C[c]) return restore(sa, sc); A[r] = p / C[c]; changed = true; }
        else if (A[r] && C[c] && A[r] * C[c] !== p) return restore(sa, sc);
      }
    }
    const fr = A.findIndex((x, i) => i > 0 && !x), fc = C.findIndex((x, i) => i > 0 && !x);
    if (fr < 0 && fc < 0) {
      const sol = {};
      for (let r = 0; r <= rows; r++) for (let c = 0; c <= cols; c++) if ((r || c) && !givens[k2(r, c)]) sol[k2(r, c)] = String(r === 0 ? C[c] : c === 0 ? A[r] : A[r] * C[c]);
      out.push(sol);
      return restore(sa, sc);
    }
    // branch on a free row factor using a product in its row
    const r = fr > 0 ? fr : null;
    if (r) {
      const p = [...Array(cols)].map((_, i) => g(r, i + 1)).find((x) => x != null);
      for (const d of p ? divisors(p) : []) { A[r] = d; rec(); A[r] = null; }
    } else {
      const c = fc;
      const p = [...Array(rows)].map((_, i) => g(i + 1, c)).find((x) => x != null);
      for (const d of p ? divisors(p) : []) { C[c] = d; rec(); C[c] = null; }
    }
    restore(sa, sc);
  };
  const restore = (sa, sc) => { sa.forEach((v, i) => (A[i] = v)); sc.forEach((v, i) => (C[i] = v)); };
  rec();
  return out;
}

/** Pyramid Descent: every path (as a cell map) whose product is the target. */
export function solvePyramid(spec) {
  const out = [];
  const rec = (r, c, p, path) => {
    const v = spec.rows[r][c];
    const np = p * v, np2 = [...path, k2(r, c)];
    if (spec.target % np) return;
    if (r === spec.rows.length - 1) { if (np === spec.target) out.push(Object.fromEntries(np2.map((k) => [k, 'P']))); return; }
    rec(r + 1, c, np, np2); rec(r + 1, c + 1, np, np2);
  };
  rec(0, 0, 1, []);
  return out;
}

/** Factor Blobs: every way to split the grid into connected blobs of 2+ squares with product = target. */
export function solveBlobs(spec, limit = 20) {
  const R = spec.nums.length, Cn = spec.nums[0].length, T = spec.target;
  const owner = spec.nums.map((row) => row.map(() => 0));
  const out = [];
  let id = 0;
  const firstFree = () => { for (let r = 0; r < R; r++) for (let c = 0; c < Cn; c++) if (!owner[r][c]) return [r, c]; return null; };
  const place = () => {
    if (out.length >= limit) return;
    const f = firstFree();
    if (!f) { out.push(Object.fromEntries(owner.flatMap((row, r) => row.map((v, c) => [k2(r, c), String(v)])))); return; }
    id++;
    const myId = id;
    const grow = (cells, p, frontierSeen) => {
      if (out.length >= limit) return;
      if (p === T && cells.length >= 2) place();
      if (p >= T) return;
      // extend with a free orthogonal neighbour that comes after the first cell (avoid duplicates by canonical order)
      const cand = new Set();
      for (const [r, c] of cells) for (const [a, b] of [[r - 1, c], [r + 1, c], [r, c - 1], [r, c + 1]])
        if (a >= 0 && b >= 0 && a < R && b < Cn && !owner[a][b] && (a * Cn + b) > (f[0] * Cn + f[1])) cand.add(a * Cn + b);
      for (const k of [...cand].sort((x, y) => x - y)) {
        if (frontierSeen.has(k)) continue;
        const a = Math.floor(k / Cn), b = k % Cn, v = spec.nums[a][b];
        if (T % (p * v)) continue;
        owner[a][b] = myId;
        grow([...cells, [a, b]], p * v, new Set([...frontierSeen, ...[...cand].filter((x) => x < k)]));
        owner[a][b] = 0;
      }
    };
    owner[f[0]][f[1]] = myId;
    grow([f], spec.nums[f[0]][f[1]], new Set());
    owner[f[0]][f[1]] = 0;
    id--;
  };
  place();
  return out;
}

export function deriveC7(spec) {
  if (spec.type === 'timestable') { const s = solveTimesTable(spec); if (s.length !== 1) throw new Error(`${s.length} solutions`); return s[0]; }
  if (spec.type === 'pyramid') { const s = solvePyramid(spec); if (!s.length) throw new Error('no path'); if (s.length > 1) throw new Error(`${s.length} paths`); return s[0]; }
  if (spec.type === 'blobs') { const s = solveBlobs(spec); if (!s.length) throw new Error('no solution'); return Object.assign(s[0], { __count: s.length }); }
  if (spec.type === 'sieve') { const out = {}; for (let n = spec.from; n <= spec.to; n++) { let p = n > 1; for (let d = 2; d * d <= n; d++) if (n % d === 0) p = false; out[n] = p ? 'O' : 'X'; } return out; }
  return derive(spec);
}
