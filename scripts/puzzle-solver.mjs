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
