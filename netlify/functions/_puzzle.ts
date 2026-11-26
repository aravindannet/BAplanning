// Interactive puzzles (Beast Academy Logic chapter): layouts, the answer check, rule-only conflict
// highlighting, and a validator for stored solutions. Pure (no imports) so the browser, the server, and
// the tests all share it. Cells are keyed "r,c" (0-based); hive hexes are keyed by their index.

export type Cells = Record<string, string>;

/** Hexagons are laid out in rows; `x` is in half-hex steps, so neighbours are (same row, x±2) and (row±1, x±1). */
export type Hex = [row: number, x: number];

export type PuzzleSpec =
  /** `ask`: only these cells are checked ("what goes in the shaded square"); `fill`: only where these digits go is checked ("fill in the remaining 3's"). */
  | { type: 'sudoku'; size: number; regions?: number[][]; givens: Cells; ask?: string[]; fill?: string[] }
  | { type: 'sumdoku'; size: number; cages: { cells: string[]; sum: number }[]; givens: Cells; ask?: string[] }
  | { type: 'timesout'; size: number; digits: number; rowClues: (number | null)[]; colClues: (number | null)[]; givens?: Cells }
  | { type: 'minesweeper'; rows: number; cols: number; clues: Record<string, number> }
  | { type: 'tents'; rows: number; cols: number; trees: string[] }
  | { type: 'hive'; hexes: Hex[]; givens: Cells; max: number; flat?: boolean }
  | { type: 'logicgrid'; rowGroups: string[][]; colGroups: string[][] }
  /** Factor Blobs: group every number into connected blobs (2+ squares) whose product is `target`. Cells: "r,c" -> blob id. */
  | { type: 'blobs'; nums: number[][]; target: number }
  /** Pyramid Descent: one touching square per row, top to bottom, whose product is `target`. Cells: "r,c" -> "P". */
  // Pyramid Descent: the path multiplies to `target`. Division Pyramid (`divisor`): each block on the path is the one above ÷ divisor.
  | { type: 'pyramid'; rows: number[][]; target?: number; divisor?: number }
  /** Times Table: row 0 holds the column factors, column 0 the row factors; "0,0" is the × corner. */
  | { type: 'timestable'; rows: number; cols: number; givens: Cells }
  /** Sieve of Eratosthenes on from..to: circle ("O") every prime, cross ("X") every other number. Cells keyed by the number. */
  | { type: 'sieve'; from: number; to: number }
  /**
   * Fraction-Sum Link: connect pairs of numbers whose sum is `target` with paths that go up/down/left/right
   * through empty squares; one path per square. `nums`: "r,c" -> "1 3/7". Cells: "r,c" -> path letter +
   * step ("A0", "A1", ...); a path starts and ends on a number.
   */
  | { type: 'sumlink'; rows: number; cols: number; nums: Record<string, string>; target: number }
  /**
   * Constellation Puzzle: join every group of equal numbers with one path of straight lines. Lines may not
   * cross or pass through another dot. `dots`: positions in any units. Cells: "i-j" (i < j) -> "1" = a line.
   */
  | { type: 'constellation'; dots: { x: number; y: number; v: string }[] }
  /**
   * Maze Escape: from the `start` square, skip-count (the same step every move, up/down/left/right) to the
   * `exit` square, which has the way out on its `exitSide`. Cells: "r,c" -> step number ("1" = start).
   */
  | { type: 'maze'; nums: string[][]; start: string; exit: string; exitSide: 'top' | 'bottom' | 'left' | 'right' };

/** "1 3/7", "22/7", "5" -> [numerator, denominator] (exact). NaN parts for anything else. */
export function fracOf(s: string): [number, number] {
  const m = s.trim().match(/^(\d+)(?:\s+(\d+)\/(\d+))?$|^(\d+)\/(\d+)$/);
  if (!m) return [NaN, 1];
  if (m[4]) return [Number(m[4]), Number(m[5])];
  if (m[2]) return [Number(m[1]) * Number(m[3]) + Number(m[2]), Number(m[3])];
  return [Number(m[1]), 1];
}
const fracEq = (a: [number, number], b: [number, number]) => a[0] * b[1] === b[0] * a[1];
const fracAdd = (a: [number, number], b: [number, number]): [number, number] => [a[0] * b[1] + b[0] * a[1], a[1] * b[1]];
const fracSub = (a: [number, number], b: [number, number]): [number, number] => [a[0] * b[1] - b[0] * a[1], a[1] * b[1]];

/** Sum-link paths on the board: letter -> cell keys in step order (cells with a bad value are ignored). */
export function linkPaths(cells: Cells): Map<string, string[]> {
  const m = new Map<string, [number, string][]>();
  for (const [k, v] of Object.entries(cells)) {
    const mm = (v ?? '').trim().match(/^([A-Z])(\d+)$/);
    if (mm) m.set(mm[1], [...(m.get(mm[1]) ?? []), [Number(mm[2]), k]]);
  }
  return new Map([...m].map(([id, xs]) => [id, xs.sort((a, b) => a[0] - b[0]).map((x) => x[1])]));
}

/** Constellation lines on the board: [i, j] pairs. */
export function starLines(cells: Cells): [number, number][] {
  return Object.entries(cells).filter(([, v]) => (v ?? '').trim() === '1').map(([k]) => k.split('-').map(Number) as [number, number]).filter(([i, j]) => Number.isInteger(i) && Number.isInteger(j) && i < j);
}

/** Maze path on the board: cell keys in step order. */
export function mazePath(cells: Cells): string[] {
  return Object.entries(cells).filter(([, v]) => /^\d+$/.test((v ?? '').trim())).sort((a, b) => Number(a[1]) - Number(b[1])).map(([k]) => k);
}

type Pt = { x: number; y: number };
const cross = (o: Pt, a: Pt, b: Pt) => (a.x - o.x) * (b.y - o.y) - (a.y - o.y) * (b.x - o.x);
/** Do segments ab and cd cross (touching at a shared end does not count)? */
export function segmentsCross(a: Pt, b: Pt, c: Pt, d: Pt): boolean {
  const d1 = cross(c, d, a), d2 = cross(c, d, b), d3 = cross(a, b, c), d4 = cross(a, b, d);
  return ((d1 > 0 && d2 < 0) || (d1 < 0 && d2 > 0)) && ((d3 > 0 && d4 < 0) || (d3 < 0 && d4 > 0));
}
/** Does segment ab pass through point p (not at its ends)? `tol` is in the dots' units. */
export function passesThrough(a: Pt, b: Pt, p: Pt, tol: number): boolean {
  const L2 = (b.x - a.x) ** 2 + (b.y - a.y) ** 2;
  if (!L2) return false;
  const t = ((p.x - a.x) * (b.x - a.x) + (p.y - a.y) * (b.y - a.y)) / L2;
  if (t <= 0.02 || t >= 0.98) return false;
  return Math.abs(cross(a, b, p)) / Math.sqrt(L2) < tol;
}
/** Through-a-dot tolerance: 4% of the board's larger side. */
const starTol = (dots: Pt[]) => 0.04 * Math.max(Math.max(...dots.map((d) => d.x)) - Math.min(...dots.map((d) => d.x)), Math.max(...dots.map((d) => d.y)) - Math.min(...dots.map((d) => d.y)), 1);

export const key = (r: number, c: number) => `${r},${c}`;
export const unkey = (k: string) => k.split(',').map(Number) as [number, number];

/** Region id per cell: explicit (pentomino), else the standard 2×2 boxes of a 4×4 sudoku. */
export function regionOf(spec: { size: number; regions?: number[][] }, r: number, c: number): number {
  if (spec.regions) return spec.regions[r][c];
  const b = Math.round(Math.sqrt(spec.size));
  return Math.floor(r / b) * b + Math.floor(c / b);
}

export function hexNeighbours(hexes: Hex[], i: number): number[] {
  const [r, x] = hexes[i];
  return hexes.flatMap(([r2, x2], j) => (j !== i && ((r2 === r && Math.abs(x2 - x) === 2) || (Math.abs(r2 - r) === 1 && Math.abs(x2 - x) === 1)) ? [j] : []));
}

const around = (r: number, c: number, rows: number, cols: number, diag = true) => {
  const out: [number, number][] = [];
  for (let dr = -1; dr <= 1; dr++)
    for (let dc = -1; dc <= 1; dc++) {
      if ((!dr && !dc) || (!diag && dr && dc)) continue;
      const rr = r + dr, cc = c + dc;
      if (rr >= 0 && rr < rows && cc >= 0 && cc < cols) out.push([rr, cc]);
    }
  return out;
};

/** The cells a kid fills in (everything that isn't a given or a clue). */
export function editableCells(spec: PuzzleSpec): string[] {
  switch (spec.type) {
    case 'sudoku':
    case 'sumdoku': {
      const out: string[] = [];
      for (let r = 0; r < spec.size; r++) for (let c = 0; c < spec.size; c++) if (!spec.givens[key(r, c)]) out.push(key(r, c));
      return out;
    }
    case 'timesout': {
      const out: string[] = [];
      for (let r = 0; r < spec.size; r++) for (let c = 0; c < spec.size; c++) if (!spec.givens?.[key(r, c)]) out.push(key(r, c));
      return out;
    }
    case 'minesweeper':
    case 'tents': {
      const fixed = new Set(spec.type === 'tents' ? spec.trees : Object.keys(spec.clues));
      const out: string[] = [];
      for (let r = 0; r < spec.rows; r++) for (let c = 0; c < spec.cols; c++) if (!fixed.has(key(r, c))) out.push(key(r, c));
      return out;
    }
    case 'hive':
      return spec.hexes.map((_, i) => String(i)).filter((k) => !spec.givens[k]);
    case 'logicgrid':
      return [];
    case 'blobs':
      return spec.nums.flatMap((row, r) => row.map((_, c) => key(r, c)));
    case 'pyramid':
      return spec.rows.flatMap((row, r) => row.map((_, c) => key(r, c)));
    case 'timestable': {
      const out: string[] = [];
      for (let r = 0; r <= spec.rows; r++) for (let c = 0; c <= spec.cols; c++) if ((r || c) && !spec.givens[key(r, c)]) out.push(key(r, c));
      return out;
    }
    case 'sieve':
      return [...Array(spec.to - spec.from + 1)].map((_, i) => String(spec.from + i));
    case 'sumlink': {
      const out: string[] = [];
      for (let r = 0; r < spec.rows; r++) for (let c = 0; c < spec.cols; c++) out.push(key(r, c));
      return out;
    }
    case 'constellation': {
      const out: string[] = [];
      for (let i = 0; i < spec.dots.length; i++) for (let j = i + 1; j < spec.dots.length; j++) out.push(`${i}-${j}`);
      return out;
    }
    case 'maze':
      return spec.nums.flatMap((row, r) => row.map((_, c) => key(r, c)));
  }
}

export const isPrime = (n: number) => {
  if (n < 2) return false;
  for (let d = 2; d * d <= n; d++) if (n % d === 0) return false;
  return true;
};
const prod = (xs: number[]) => xs.reduce((a, b) => a * b, 1);
const orth = (r: number, c: number): [number, number][] => [[r - 1, c], [r + 1, c], [r, c - 1], [r, c + 1]];

/** Blob groups on the kid's board: id -> cell keys. */
function blobGroups(cells: Cells): Map<string, string[]> {
  const m = new Map<string, string[]>();
  for (const [k, v] of Object.entries(cells)) if (v) m.set(v, [...(m.get(v) ?? []), k]);
  return m;
}
const connected = (ks: string[]) => {
  const set = new Set(ks);
  const seen = new Set([ks[0]]);
  const stack = [ks[0]];
  while (stack.length) {
    const [r, c] = unkey(stack.pop()!);
    for (const [a, b] of orth(r, c)) {
      const k = key(a, b);
      if (set.has(k) && !seen.has(k)) { seen.add(k); stack.push(k); }
    }
  }
  return seen.size === set.size;
};

/** Rule problems for the puzzles that are checked by their rules rather than one stored answer. */
function ruleErrors(spec: PuzzleSpec, cells: Cells): string[] {
  const errs: string[] = [];
  if (spec.type === 'blobs') {
    const all = editableCells(spec);
    const missing = all.filter((k) => !cells[k]);
    if (missing.length) errs.push(`${missing.length} squares are not in a blob`);
    for (const [id, ks] of blobGroups(cells)) {
      const num = ks.map((k) => { const [r, c] = unkey(k); return spec.nums[r]?.[c]; });
      if (num.some((x) => x == null)) { errs.push(`blob ${id} has a square off the grid`); continue; }
      if (ks.length < 2) errs.push(`blob ${id} has only one square`);
      if (!connected(ks)) errs.push(`blob ${id} is not connected`);
      if (prod(num as number[]) !== spec.target) errs.push(`blob ${id} multiplies to ${prod(num as number[])}`);
    }
  } else if (spec.type === 'pyramid') {
    let prev = -1;
    const vals: number[] = [];
    spec.rows.forEach((row, r) => {
      const picked = row.map((_, c) => c).filter((c) => norm(cells[key(r, c)]) === 'P');
      if (picked.length !== 1) { errs.push(`row ${r + 1} has ${picked.length} squares picked`); return; }
      const c = picked[0];
      if (prev >= 0 && c !== prev && c !== prev + 1) errs.push(`row ${r + 1} does not touch the square above`);
      prev = c;
      vals.push(row[c]);
    });
    if (!errs.length && spec.divisor) {
      for (let i = 1; i < vals.length; i++) if (vals[i] * spec.divisor !== vals[i - 1]) errs.push(`row ${i + 1}: ${vals[i - 1]} ÷ ${spec.divisor} is not ${vals[i]}`);
    } else if (!errs.length && prod(vals) !== spec.target) errs.push(`the path multiplies to ${prod(vals)}`);
  } else if (spec.type === 'sieve') {
    for (let n = spec.from; n <= spec.to; n++) {
      const v = norm(cells[String(n)]);
      if (v !== (isPrime(n) ? 'O' : 'X')) errs.push(`${n} should be ${isPrime(n) ? 'circled' : 'crossed out'}`);
    }
  } else if (spec.type === 'sumlink') {
    const used = new Set<string>();
    for (const [id, ks] of linkPaths(cells)) {
      if (ks.some((k) => { const [r, c] = unkey(k); return !(r >= 0 && c >= 0 && r < spec.rows && c < spec.cols); })) { errs.push(`path ${id} leaves the grid`); continue; }
      const steps = ks.map((k) => Number(cells[k].trim().slice(1)));
      if (steps.some((s, i) => s !== i)) errs.push(`path ${id} skips a step`);
      if (ks.length < 2) { errs.push(`path ${id} has only one square`); continue; }
      for (let i = 1; i < ks.length; i++) {
        const [r1, c1] = unkey(ks[i - 1]), [r2, c2] = unkey(ks[i]);
        if (Math.abs(r1 - r2) + Math.abs(c1 - c2) !== 1) errs.push(`path ${id} jumps between squares`);
      }
      const a = spec.nums[ks[0]], b = spec.nums[ks[ks.length - 1]];
      if (!a || !b) errs.push(`path ${id} does not end on numbers`);
      if (ks.slice(1, -1).some((k) => spec.nums[k])) errs.push(`path ${id} goes through a number`);
      if (a && b && !fracEq(fracAdd(fracOf(a), fracOf(b)), [spec.target, 1])) errs.push(`path ${id}: ${a} + ${b} is not ${spec.target}`);
      if (a) used.add(ks[0]);
      if (b) used.add(ks[ks.length - 1]);
    }
    const left = Object.keys(spec.nums).filter((k) => !used.has(k));
    if (left.length) errs.push(`${left.length} numbers are not connected`);
  } else if (spec.type === 'constellation') {
    const dots = spec.dots;
    const lines = starLines(cells).filter(([i, j]) => dots[i] && dots[j]);
    const tol = starTol(dots);
    for (const [i, j] of lines) if (!fracEq(fracOf(dots[i].v), fracOf(dots[j].v))) errs.push(`${dots[i].v} and ${dots[j].v} are not equal`);
    // every group of equal numbers: one path through all its dots (n-1 lines, no dot on 3+ lines, connected)
    const groups: number[][] = [];
    dots.forEach((d, i) => { const g = groups.find((gg) => fracEq(fracOf(dots[gg[0]].v), fracOf(d.v))); if (g) g.push(i); else groups.push([i]); });
    for (const g of groups) {
      if (g.length < 2) continue;
      const inG = lines.filter(([i, j]) => g.includes(i) && g.includes(j));
      const deg = (i: number) => inG.filter(([a, b]) => a === i || b === i).length;
      const seen = new Set([g[0]]);
      const stack = [g[0]];
      while (stack.length) { const x = stack.pop()!; for (const [a, b] of inG) { const y = a === x ? b : b === x ? a : -1; if (y >= 0 && !seen.has(y)) { seen.add(y); stack.push(y); } } }
      if (inG.length !== g.length - 1 || g.some((i) => deg(i) > 2) || seen.size !== g.length) errs.push(`${dots[g[0]].v} group is not one path`);
    }
    for (let a = 0; a < lines.length; a++)
      for (let b = a + 1; b < lines.length; b++) {
        const [i, j] = lines[a], [k, l] = lines[b];
        if (segmentsCross(dots[i], dots[j], dots[k], dots[l])) errs.push(`lines ${i}-${j} and ${k}-${l} cross`);
      }
    for (const [i, j] of lines) dots.forEach((p, k) => { if (k !== i && k !== j && passesThrough(dots[i], dots[j], p, tol)) errs.push(`line ${i}-${j} passes through ${p.v}`); });
  } else if (spec.type === 'maze') {
    const ks = mazePath(cells);
    const val = (k: string) => { const [r, c] = unkey(k); return spec.nums[r]?.[c]; };
    if (ks.some((k) => val(k) == null)) return ['the path leaves the maze'];
    if (ks.some((k, i) => Number(cells[k].trim()) !== i + 1)) errs.push('the path skips a step');
    if (ks[0] !== spec.start) errs.push('the path does not begin at the start');
    if (ks[ks.length - 1] !== spec.exit) errs.push('the path does not reach the exit');
    for (let i = 1; i < ks.length; i++) {
      const [r1, c1] = unkey(ks[i - 1]), [r2, c2] = unkey(ks[i]);
      if (Math.abs(r1 - r2) + Math.abs(c1 - c2) !== 1) errs.push(`step ${i + 1} jumps`);
    }
    if (ks.length >= 2) {
      const step = fracSub(fracOf(val(ks[1])!), fracOf(val(ks[0])!));
      if (step[0] === 0) errs.push('the path does not count');
      for (let i = 2; i < ks.length; i++) if (!fracEq(fracSub(fracOf(val(ks[i])!), fracOf(val(ks[i - 1])!)), step)) errs.push(`step ${i + 1} is not the same skip`);
    }
  }
  return errs;
}

const norm = (v: string | undefined) => (v ?? '').trim().toUpperCase();

/** Puzzles with more than one correct picture (or where the rule is the answer): the rules decide. */
const RULE_CHECKED: PuzzleSpec['type'][] = ['blobs', 'pyramid', 'sieve', 'sumlink', 'constellation', 'maze'];

/**
 * Is the kid's board right? Sudoku-like puzzles compare the asked cells (or every open cell) with the
 * solution; minesweeper and tents compare the set of marked mines / tents (✗ marks are only notes).
 */
export function checkPuzzle(spec: PuzzleSpec, solution: Cells, cells: Cells): boolean {
  if (spec.type === 'minesweeper' || spec.type === 'tents') {
    const mark = spec.type === 'minesweeper' ? 'M' : 'T';
    const want = new Set(Object.keys(solution).filter((k) => norm(solution[k]) === mark));
    const got = new Set(Object.keys(cells).filter((k) => norm(cells[k]) === mark));
    return want.size === got.size && [...want].every((k) => got.has(k));
  }
  if (spec.type === 'logicgrid') return true; // only the answer picks are checked
  // these have more than one correct picture (or the rule is the answer), so the rules decide
  if (RULE_CHECKED.includes(spec.type)) return ruleErrors(spec, cells).length === 0;
  if (spec.type === 'sudoku' && spec.fill?.length) {
    // every place a fill digit belongs must hold it, and no fill digit may be anywhere else
    return editableCells(spec).every((k) => {
      const got = norm(cells[k]);
      const want = norm(solution[k]);
      return want || spec.fill!.includes(got) ? got === want : true;
    });
  }
  const keys = 'ask' in spec && spec.ask?.length ? spec.ask : editableCells(spec);
  return keys.every((k) => norm(cells[k]) === norm(solution[k]));
}

/** Every value on the board: givens plus the kid's cells. */
function board(spec: PuzzleSpec, cells: Cells): Cells {
  const givens = 'givens' in spec ? spec.givens ?? {} : {};
  return { ...cells, ...givens };
}

/**
 * Cells that break a rule given what is on the board right now. Uses only the puzzle's rules, never the
 * solution, so it can run in the browser without giving anything away.
 */
export function conflicts(spec: PuzzleSpec, cells: Cells): Set<string> {
  const bad = new Set<string>();
  if (spec.type === 'blobs') {
    // a blob that can no longer reach the target (too big, or not a factor of it)
    for (const ks of blobGroups(cells).values()) {
      const p = prod(ks.map((k) => { const [r, c] = unkey(k); return spec.nums[r]?.[c] ?? 1; }));
      if (p > spec.target || spec.target % p !== 0) ks.forEach((k) => bad.add(k));
    }
    return bad;
  }
  if (spec.type === 'pyramid') {
    let prev: number | null = null;
    spec.rows.forEach((row, r) => {
      const picked = row.map((_, c) => c).filter((c) => norm(cells[key(r, c)]) === 'P');
      if (picked.length > 1) picked.forEach((c) => bad.add(key(r, c)));
      if (picked.length === 1) {
        if (prev !== null && picked[0] !== prev && picked[0] !== prev + 1) bad.add(key(r, picked[0]));
        prev = picked[0];
      }
    });
    return bad;
  }
  if (spec.type === 'timestable') {
    const v = (k: string) => Number((spec.givens[k] ?? cells[k] ?? '').trim()) || 0;
    for (let r = 1; r <= spec.rows; r++)
      for (let c = 1; c <= spec.cols; c++) {
        const a = v(key(r, 0)), b2 = v(key(0, c)), x = v(key(r, c));
        if (a && b2 && x && a * b2 !== x) [key(r, 0), key(0, c), key(r, c)].forEach((k) => !spec.givens[k] && bad.add(k));
      }
    return bad;
  }
  if (spec.type === 'sieve' || spec.type === 'sumlink' || spec.type === 'maze') return bad; // the sums and the skips are the puzzle
  if (spec.type === 'constellation') {
    // only the drawing rules: lines that cross, or a line through another dot
    const lines = starLines(cells).filter(([i, j]) => spec.dots[i] && spec.dots[j]);
    const tol = starTol(spec.dots);
    const d = spec.dots;
    for (let a = 0; a < lines.length; a++)
      for (let b2 = a + 1; b2 < lines.length; b2++) {
        const [i, j] = lines[a], [k, l] = lines[b2];
        if (segmentsCross(d[i], d[j], d[k], d[l])) { bad.add(`${i}-${j}`); bad.add(`${k}-${l}`); }
      }
    for (const [i, j] of lines) if (d.some((p, k) => k !== i && k !== j && passesThrough(d[i], d[j], p, tol))) bad.add(`${i}-${j}`);
    return bad;
  }
  const b = board(spec, cells);
  const val = (k: string) => (b[k] ?? '').trim();
  const dupes = (groups: string[][]) => {
    for (const g of groups) {
      const seen = new Map<string, string[]>();
      for (const k of g) if (val(k)) seen.set(val(k), [...(seen.get(val(k)) ?? []), k]);
      for (const ks of seen.values()) if (ks.length > 1) ks.forEach((k) => bad.add(k));
    }
  };
  if (spec.type === 'sudoku' || spec.type === 'sumdoku' || spec.type === 'timesout') {
    const n = spec.size;
    const rows = [...Array(n)].map((_, r) => [...Array(n)].map((__, c) => key(r, c)));
    const cols = [...Array(n)].map((_, c) => [...Array(n)].map((__, r) => key(r, c)));
    if (spec.type === 'timesout') {
      dupes([Object.keys(b)]); // each digit at most once in the whole grid
      [...rows.map((g, i) => [g, spec.rowClues[i]] as const), ...cols.map((g, i) => [g, spec.colClues[i]] as const)].forEach(([g, clue]) => {
        const filled = g.filter((k) => val(k));
        if (filled.length > 2) filled.forEach((k) => bad.add(k));
        if (clue != null && filled.length === 2 && Number(val(filled[0])) * Number(val(filled[1])) !== clue) filled.forEach((k) => bad.add(k));
        if (clue != null && filled.length === 1 && clue % Number(val(filled[0])) !== 0) filled.forEach((k) => bad.add(k));
      });
      return bad;
    }
    const groups = [...rows, ...cols];
    if (spec.type === 'sudoku') {
      const reg = new Map<number, string[]>();
      for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) reg.set(regionOf(spec, r, c), [...(reg.get(regionOf(spec, r, c)) ?? []), key(r, c)]);
      groups.push(...reg.values());
    } else {
      for (const cage of spec.cages) {
        const vs = cage.cells.map(val);
        const sum = vs.reduce((s, v) => s + (Number(v) || 0), 0);
        if (sum > cage.sum || (vs.every(Boolean) && sum !== cage.sum)) cage.cells.forEach((k) => val(k) && bad.add(k));
      }
    }
    dupes(groups);
  } else if (spec.type === 'minesweeper') {
    for (const [k, n] of Object.entries(spec.clues)) {
      const [r, c] = unkey(k);
      const ns = around(r, c, spec.rows, spec.cols).map(([a, b2]) => key(a, b2)).filter((x) => !(x in spec.clues));
      const mines = ns.filter((x) => norm(cells[x]) === 'M').length;
      const open = ns.filter((x) => norm(cells[x]) !== 'X').length;
      if (mines > n || open < n) bad.add(k);
    }
  } else if (spec.type === 'tents') {
    const tents = Object.keys(cells).filter((k) => norm(cells[k]) === 'T');
    for (const t of tents) {
      const [r, c] = unkey(t);
      if (around(r, c, spec.rows, spec.cols).some(([a, b2]) => norm(cells[key(a, b2)]) === 'T')) bad.add(t);
      if (!around(r, c, spec.rows, spec.cols, false).some(([a, b2]) => spec.trees.includes(key(a, b2)))) bad.add(t);
    }
  } else if (spec.type === 'hive') {
    spec.hexes.forEach((_, i) => {
      const v = Number(val(String(i)));
      if (!v) return;
      const ns = hexNeighbours(spec.hexes, i).map((j) => Number(val(String(j))));
      // a neighbour with the same number, or a filled board where v isn't the smallest missing number
      if (ns.includes(v)) bad.add(String(i));
      else if (ns.every(Boolean)) {
        let mex = 1;
        while (ns.includes(mex)) mex++;
        if (mex !== v) bad.add(String(i));
      }
    });
  }
  return bad;
}

/** Problems with a stored solution (for the content check): empty list = the solution obeys every rule. */
export function validateSolution(spec: PuzzleSpec, solution: Cells): string[] {
  if (RULE_CHECKED.includes(spec.type)) return ruleErrors(spec, solution);
  const errs: string[] = [];
  if (spec.type === 'timestable') {
    const v = (k: string) => Number((spec.givens[k] ?? solution[k] ?? '').trim());
    for (let r = 1; r <= spec.rows; r++)
      for (let c = 1; c <= spec.cols; c++) if (v(key(r, 0)) * v(key(0, c)) !== v(key(r, c))) errs.push(`(${r},${c}) is not ${v(key(r, 0))}×${v(key(0, c))}`);
    return errs;
  }
  const b = board(spec, solution);
  const v = (k: string) => (b[k] ?? '').trim();
  if (spec.type === 'sudoku' || spec.type === 'sumdoku') {
    const n = spec.size;
    const full = [...Array(n)].map((_, i) => String(i + 1)).join(',');
    const check = (name: string, g: string[]) => {
      if (g.map(v).sort().join(',') !== full) errs.push(`${name} is not 1-${n}: ${g.map(v).join('')}`);
    };
    for (let i = 0; i < n; i++) {
      check(`row ${i + 1}`, [...Array(n)].map((_, c) => key(i, c)));
      check(`column ${i + 1}`, [...Array(n)].map((_, r) => key(r, i)));
    }
    if (spec.type === 'sudoku') {
      const reg = new Map<number, string[]>();
      for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) reg.set(regionOf(spec, r, c), [...(reg.get(regionOf(spec, r, c)) ?? []), key(r, c)]);
      for (const [id, g] of reg) check(`region ${id}`, g);
    } else {
      for (const cage of spec.cages) {
        const s = cage.cells.reduce((t, k) => t + Number(v(k)), 0);
        if (s !== cage.sum) errs.push(`cage ${cage.cells.join(' ')} sums to ${s}, not ${cage.sum}`);
      }
    }
  } else if (spec.type === 'timesout') {
    const used: number[] = [];
    for (let i = 0; i < spec.size; i++) {
      const row = [...Array(spec.size)].map((_, c) => v(key(i, c))).filter(Boolean).map(Number);
      const col = [...Array(spec.size)].map((_, r) => v(key(r, i))).filter(Boolean).map(Number);
      if (row.length !== 2) errs.push(`row ${i + 1} has ${row.length} numbers`);
      if (col.length !== 2) errs.push(`column ${i + 1} has ${col.length} numbers`);
      if (spec.rowClues[i] != null && row.length === 2 && row[0] * row[1] !== spec.rowClues[i]) errs.push(`row ${i + 1} product ${row[0] * row[1]} ≠ ${spec.rowClues[i]}`);
      if (spec.colClues[i] != null && col.length === 2 && col[0] * col[1] !== spec.colClues[i]) errs.push(`column ${i + 1} product ${col[0] * col[1]} ≠ ${spec.colClues[i]}`);
      used.push(...row);
    }
    if (used.sort((a, c) => a - c).join(',') !== [...Array(spec.digits)].map((_, i) => i + 1).join(',')) errs.push(`digits used: ${used.join(',')}`);
  } else if (spec.type === 'minesweeper') {
    for (const [k, n] of Object.entries(spec.clues)) {
      const [r, c] = unkey(k);
      const m = around(r, c, spec.rows, spec.cols).filter(([a, b2]) => norm(solution[key(a, b2)]) === 'M').length;
      if (m !== n) errs.push(`clue ${n} at ${k} touches ${m} mines`);
    }
    for (const k of Object.keys(solution)) if (k in spec.clues && norm(solution[k]) === 'M') errs.push(`mine on a clue at ${k}`);
  } else if (spec.type === 'tents') {
    const tents = Object.keys(solution).filter((k) => norm(solution[k]) === 'T');
    if (tents.length !== spec.trees.length) errs.push(`${tents.length} tents for ${spec.trees.length} trees`);
    for (const t of tents) {
      const [r, c] = unkey(t);
      if (spec.trees.includes(t)) errs.push(`tent on a tree at ${t}`);
      if (around(r, c, spec.rows, spec.cols).some(([a, b2]) => tents.includes(key(a, b2)))) errs.push(`tents touch at ${t}`);
    }
    // every tree gets its own orthogonally adjacent tent (bipartite matching)
    const match = new Map<string, string>();
    const tryTree = (tree: string, seen: Set<string>): boolean => {
      const [r, c] = unkey(tree);
      for (const [a, b2] of around(r, c, spec.rows, spec.cols, false)) {
        const t = key(a, b2);
        if (!tents.includes(t) || seen.has(t)) continue;
        seen.add(t);
        if (!match.has(t) || tryTree(match.get(t)!, seen)) {
          match.set(t, tree);
          return true;
        }
      }
      return false;
    };
    for (const tree of spec.trees) if (!tryTree(tree, new Set())) errs.push(`tree ${tree} has no tent of its own`);
  } else if (spec.type === 'hive') {
    spec.hexes.forEach((_, i) => {
      const x = Number(v(String(i)));
      const ns = hexNeighbours(spec.hexes, i).map((j) => Number(v(String(j))));
      let mex = 1;
      while (ns.includes(mex)) mex++;
      if (x !== mex) errs.push(`hex ${i} is ${x}, should be ${mex}`);
    });
  }
  return errs;
}

/** Plain-text picture of a puzzle and the kid's board, for the hint model. */
export function describePuzzle(spec: PuzzleSpec, cells: Cells): string {
  const b = board(spec, cells);
  const cell = (k: string) => (b[k] ?? '').trim() || '.';
  if (spec.type === 'hive') {
    return `Hive (each hexagon holds the smallest number that does not appear in any hexagon it touches). Hexagons (row, position: value): ${spec.hexes.map(([r, x], i) => `(${r},${x}: ${cell(String(i))})`).join(' ')}`;
  }
  if (spec.type === 'logicgrid' || spec.type === 'sieve') return '';
  if (spec.type === 'sumlink') {
    const paths = [...linkPaths(cells).values()].filter((ks) => ks.length >= 2 && spec.nums[ks[0]] && spec.nums[ks[ks.length - 1]]).map((ks) => `${spec.nums[ks[0]]} with ${spec.nums[ks[ks.length - 1]]}`);
    return `Fraction-Sum Link puzzle, target sum ${spec.target}: connect pairs of numbers that add up to the target with paths through empty squares (up, down, left, right; paths may not cross or share a square). Numbers on the ${spec.rows}×${spec.cols} grid: ${Object.values(spec.nums).join(', ')}.\nPairs the child has connected so far: ${paths.join('; ') || 'none yet'}`;
  }
  if (spec.type === 'constellation') {
    const lines = starLines(cells).filter(([i, j]) => spec.dots[i] && spec.dots[j]).map(([i, j]) => `${spec.dots[i].v} — ${spec.dots[j].v}`);
    return `Constellation Puzzle: join every group of equal numbers with one path of straight lines that do not cross or pass through another dot. Dots: ${spec.dots.map((d) => d.v).join(', ')}.\nLines the child has drawn: ${lines.join('; ') || 'none yet'}`;
  }
  if (spec.type === 'maze') {
    const [sr, sc] = unkey(spec.start), [er, ec] = unkey(spec.exit);
    const path = mazePath(cells).map((k) => { const [r, c] = unkey(k); return spec.nums[r]?.[c]; }).filter(Boolean);
    return `Maze Escape: start at ${spec.nums[sr][sc]} and skip-count (the same step every move, up/down/left/right) to the exit beside ${spec.nums[er][ec]}. Maze rows:\n${spec.nums.map((row) => row.join(' | ')).join('\n')}\nThe child's path so far: ${path.join(' → ') || 'none yet'}`;
  }
  if (spec.type === 'blobs') {
    const ids = blobGroups(cells);
    return `Factor Blob puzzle, target ${spec.target}. Grid:\n${spec.nums.map((row) => row.join(' ')).join('\n')}\nThe child's blobs: ${[...ids.values()].map((ks) => ks.map((k) => { const [r, c] = unkey(k); return spec.nums[r][c]; }).join('×')).join(' | ') || 'none yet'}`;
  }
  if (spec.type === 'pyramid') {
    const path = spec.rows.map((row, r) => row.find((_, c) => norm(cells[key(r, c)]) === 'P')).filter((x) => x != null);
    if (spec.divisor) return `Division Pyramid: start at the top block, divide by ${spec.divisor}, and move to the touching block below that holds the quotient, down to the bottom row. Rows from the top:\n${spec.rows.map((row) => row.join(' ')).join('\n')}\nThe child's path: ${path.join(' → ') || 'none yet'}`;
    return `Pyramid Descent, target ${spec.target}. Rows from the top:\n${spec.rows.map((row) => row.join(' ')).join('\n')}\nThe child's path: ${path.join(' → ') || 'none yet'}`;
  }
  if (spec.type === 'timestable') {
    const lines = [...Array(spec.rows + 1)].map((_, r) => [...Array(spec.cols + 1)].map((__, c) => (r || c ? (spec.givens[key(r, c)] ?? cells[key(r, c)] ?? '') || '.' : '×')).join(' '));
    return `Times Table puzzle (top row = column factors, left column = row factors, . = empty):\n${lines.join('\n')}`;
  }
  const rows = 'size' in spec ? spec.size : spec.rows;
  const cols = 'size' in spec ? spec.size : spec.cols;
  const lines: string[] = [];
  for (let r = 0; r < rows; r++) {
    const row: string[] = [];
    for (let c = 0; c < cols; c++) {
      const k = key(r, c);
      if (spec.type === 'minesweeper') row.push(k in spec.clues ? String(spec.clues[k]) : norm(cells[k]) === 'M' ? '*' : norm(cells[k]) === 'X' ? 'x' : '.');
      else if (spec.type === 'tents') row.push(spec.trees.includes(k) ? 'O' : norm(cells[k]) === 'T' ? '^' : norm(cells[k]) === 'X' ? 'x' : '.');
      else row.push(cell(k));
    }
    lines.push(row.join(' '));
  }
  const extra =
    spec.type === 'sumdoku' ? `\nCages: ${spec.cages.map((g) => `${g.cells.join(' ')} sum ${g.sum}`).join('; ')}`
    : spec.type === 'timesout' ? `\nRow products: ${spec.rowClues.map((x) => x ?? '?').join(', ')}. Column products: ${spec.colClues.map((x) => x ?? '?').join(', ')}.`
    : '';
  const legend = spec.type === 'minesweeper' ? ' (* = the child marked a mine, x = marked empty)' : spec.type === 'tents' ? ' (O = tree, ^ = the child placed a tent, x = marked empty)' : ' (. = empty)';
  return `The child's board${legend}:\n${lines.join('\n')}${extra}`;
}
