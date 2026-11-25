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
  | { type: 'logicgrid'; rowGroups: string[][]; colGroups: string[][] };

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
  }
}

const norm = (v: string | undefined) => (v ?? '').trim().toUpperCase();

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
  const errs: string[] = [];
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
  if (spec.type === 'logicgrid') return '';
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
