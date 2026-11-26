import { useEffect, useMemo, useState } from 'react';
import { conflicts, key, regionOf, type Cells, type PuzzleSpec } from '../../../netlify/functions/_puzzle';
import { BlobBoard, PyramidBoard, SieveBoard, TimesTableBoard } from './FactorBoards';
import { ConstellationBoard, MazeBoard, SumLinkBoard } from './PathBoards';

interface Props {
  spec: PuzzleSpec;
  cells: Cells;
  onChange?: (cells: Cells) => void; // omitted = read-only
}

/**
 * The interactive board for a Logic-chapter puzzle. Numbers go in with the big number pad (or the keyboard);
 * minesweeper / tents / logic charts cycle marks with a tap. Cells that break a rule glow red; that uses
 * only the rules, never the answer.
 */
export function PuzzleBoard({ spec, cells, onChange }: Props) {
  const readOnly = !onChange;
  const bad = useMemo(() => (readOnly ? new Set<string>() : conflicts(spec, cells)), [spec, cells, readOnly]);
  const set = (k: string, v: string) => onChange?.({ ...cells, [k]: v });
  switch (spec.type) {
    case 'sudoku':
    case 'sumdoku':
    case 'timesout':
      return <NumberGrid spec={spec} cells={cells} set={set} bad={bad} readOnly={readOnly} />;
    case 'hive':
      return <HiveBoard spec={spec} cells={cells} set={set} bad={bad} readOnly={readOnly} />;
    case 'minesweeper':
    case 'tents':
      return <MarkGrid spec={spec} cells={cells} set={set} bad={bad} readOnly={readOnly} />;
    case 'logicgrid':
      return <LogicChart spec={spec} cells={cells} set={set} readOnly={readOnly} />;
    case 'blobs':
      return <BlobBoard spec={spec} cells={cells} bad={bad} readOnly={readOnly} onChange={(c) => onChange?.(c)} />;
    case 'pyramid':
      return <PyramidBoard spec={spec} cells={cells} bad={bad} readOnly={readOnly} onChange={(c) => onChange?.(c)} />;
    case 'timestable':
      return <TimesTableBoard spec={spec} cells={cells} bad={bad} readOnly={readOnly} onChange={(c) => onChange?.(c)} />;
    case 'sieve':
      return <SieveBoard spec={spec} cells={cells} bad={bad} readOnly={readOnly} onChange={(c) => onChange?.(c)} />;
    case 'sumlink':
      return <SumLinkBoard spec={spec} cells={cells} bad={bad} readOnly={readOnly} onChange={(c) => onChange?.(c)} />;
    case 'constellation':
      return <ConstellationBoard spec={spec} cells={cells} bad={bad} readOnly={readOnly} onChange={(c) => onChange?.(c)} />;
    case 'maze':
      return <MazeBoard spec={spec} cells={cells} bad={bad} readOnly={readOnly} onChange={(c) => onChange?.(c)} />;
  }
}

type Sub<T extends PuzzleSpec['type']> = { spec: Extract<PuzzleSpec, { type: T }>; cells: Cells; set: (k: string, v: string) => void; bad: Set<string>; readOnly: boolean };

/** Big buttons 1..max and Erase, sized for a finger on an iPad. */
function NumberPad({ max, onPick, disabled }: { max: number; onPick: (v: string) => void; disabled?: boolean }) {
  return (
    <div className="numpad" role="group" aria-label="Number pad">
      {[...Array(max)].map((_, i) => (
        <button key={i} type="button" className="numkey" disabled={disabled} onClick={() => onPick(String(i + 1))}>{i + 1}</button>
      ))}
      <button type="button" className="numkey erase" disabled={disabled} onClick={() => onPick('')} aria-label="Erase">⌫</button>
    </div>
  );
}

/** Lets the keyboard type into the selected cell (desktop), as well as the pad. */
function useKeys(selected: string | null, max: number, pick: (v: string) => void) {
  useEffect(() => {
    if (!selected) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      const n = Number(e.key);
      if (n >= 1 && n <= max) pick(e.key);
      else if (e.key === 'Backspace' || e.key === 'Delete' || e.key === '0') pick('');
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [selected, max, pick]);
}

function NumberGrid({ spec, cells, set, bad, readOnly }: Sub<'sudoku' | 'sumdoku' | 'timesout'>) {
  const n = spec.size;
  const givens = spec.givens ?? {};
  const max = spec.type === 'timesout' ? spec.digits : n;
  const ask = new Set('ask' in spec ? spec.ask ?? [] : []);
  const [sel, setSel] = useState<string | null>(null);
  const pick = (v: string) => sel && set(sel, v);
  useKeys(readOnly ? null : sel, max, pick);

  // region / cage id per cell, to draw the thick borders
  const group = (r: number, c: number): number => {
    if (spec.type === 'sudoku') return regionOf(spec, r, c);
    if (spec.type === 'sumdoku') return spec.cages.findIndex((g) => g.cells.includes(key(r, c)));
    return 0;
  };
  const cageLabel = (r: number, c: number): number | null => {
    if (spec.type !== 'sumdoku') return null;
    const g = spec.cages[group(r, c)];
    if (!g) return null;
    const first = [...g.cells].sort((a, b) => { const [ra, ca] = a.split(',').map(Number); const [rb, cb] = b.split(',').map(Number); return ra - rb || ca - cb; })[0];
    return first === key(r, c) ? g.sum : null;
  };
  const thick = spec.type !== 'timesout';
  const clues = spec.type === 'timesout';

  return (
    <div className={`pz pz-grid${clues ? ' with-clues' : ''}`} style={{ ['--n' as string]: n }}>
      <div className="pz-table" role="grid">
        {clues && (
          <div className="pz-row">
            <span className="pz-clue corner" />
            {spec.colClues.map((v, c) => <span key={c} className="pz-clue top">{v ?? ''}</span>)}
          </div>
        )}
        {[...Array(n)].map((_, r) => (
          <div className="pz-row" key={r}>
            {clues && <span className="pz-clue left">{spec.rowClues[r] ?? ''}</span>}
            {[...Array(n)].map((__, c) => {
              const k = key(r, c);
              const given = givens[k];
              const g = group(r, c);
              const cls = [
                'pz-cell',
                given ? 'given' : '',
                sel === k && !readOnly ? 'sel' : '',
                ask.has(k) ? 'ask' : '',
                bad.has(k) ? 'bad' : '',
                thick && (r === 0 || group(r - 1, c) !== g) ? 'bt' : '',
                thick && (c === 0 || group(r, c - 1) !== g) ? 'bl' : '',
                thick && (r === n - 1 || group(r + 1, c) !== g) ? 'bb' : '',
                thick && (c === n - 1 || group(r, c + 1) !== g) ? 'br' : '',
              ].filter(Boolean).join(' ');
              const label = cageLabel(r, c);
              return (
                <button key={c} type="button" className={cls} disabled={readOnly || !!given} onClick={() => setSel(k)} aria-label={`row ${r + 1} column ${c + 1}${given ? `, ${given}` : cells[k] ? `, ${cells[k]}` : ', empty'}`}>
                  {label != null && <span className="cage-sum">{label}</span>}
                  <span className="v">{given || cells[k] || ''}</span>
                </button>
              );
            })}
          </div>
        ))}
      </div>
      {!readOnly && <NumberPad max={max} onPick={pick} disabled={!sel} />}
    </div>
  );
}

function HiveBoard({ spec, cells, set, bad, readOnly }: Sub<'hive'>) {
  const [sel, setSel] = useState<string | null>(null);
  const pick = (v: string) => sel && set(sel, v);
  useKeys(readOnly ? null : sel, spec.max, pick);
  const R = 34;
  const W = Math.sqrt(3) * R;
  // pointy-topped hexagons in rows, or (flat) flat-topped hexagons in columns: [column, half-row]
  const pos = spec.hexes.map(([a, b]) => (spec.flat ? [a * 1.5 * R, b * (W / 2)] : [b * (W / 2), a * 1.5 * R]));
  const minX = Math.min(...pos.map((p) => p[0])), minY = Math.min(...pos.map((p) => p[1]));
  const padX = spec.flat ? R : W / 2, padY = spec.flat ? W / 2 : R;
  const cxy = (i: number) => [pos[i][0] - minX + padX + 4, pos[i][1] - minY + padY + 4];
  const pts = (x0: number, y0: number) => [...Array(6)].map((_, i) => { const a = (Math.PI / 180) * (60 * i - (spec.flat ? 0 : 90)); return `${(x0 + R * Math.cos(a)).toFixed(1)},${(y0 + R * Math.sin(a)).toFixed(1)}`; }).join(' ');
  const width = Math.max(...pos.map((p) => p[0])) - minX + 2 * padX + 8;
  const height = Math.max(...pos.map((p) => p[1])) - minY + 2 * padY + 8;
  return (
    <div className="pz pz-hive">
      <svg viewBox={`0 0 ${width} ${height}`} style={{ width: `calc(${width * 1.15}px * var(--ps, 1))`, height: `calc(${height * 1.15}px * var(--ps, 1))` }} role="grid" aria-label="Hive puzzle">
        {spec.hexes.map((_, i) => {
          const [x0, y0] = cxy(i);
          const k = String(i);
          const given = spec.givens[k];
          const v = given || cells[k] || '';
          const cls = ['hex', given ? 'given' : '', sel === k && !readOnly ? 'sel' : '', bad.has(k) ? 'bad' : ''].filter(Boolean).join(' ');
          return (
            <g key={k} className={cls} onClick={() => !readOnly && !given && setSel(k)} role="button" aria-label={`hexagon ${i + 1}${v ? `, ${v}` : ', empty'}`}>
              <polygon points={pts(x0, y0)} />
              <text x={x0} y={y0 + 1} textAnchor="middle" dominantBaseline="central">{v}</text>
            </g>
          );
        })}
      </svg>
      {!readOnly && <NumberPad max={spec.max} onPick={pick} disabled={!sel} />}
    </div>
  );
}

function MarkGrid({ spec, cells, set, bad, readOnly }: Sub<'minesweeper' | 'tents'>) {
  const mines = spec.type === 'minesweeper';
  const cycle = mines ? ['', 'M', 'X'] : ['', 'T', 'X'];
  return (
    <div className="pz pz-marks">
      <div className="pz-table" role="grid">
        {[...Array(spec.rows)].map((_, r) => (
          <div className="pz-row" key={r}>
            {[...Array(spec.cols)].map((__, c) => {
              const k = key(r, c);
              const clue = mines ? spec.clues[k] : undefined;
              const tree = !mines && spec.trees.includes(k);
              const v = (cells[k] ?? '').toUpperCase();
              if (clue != null || tree) {
                return (
                  <span key={c} className={`pz-cell fixed${bad.has(k) ? ' bad' : ''}`}>
                    {tree ? <span className="tree" aria-label="tree">🌳</span> : <span className="v">{clue}</span>}
                  </span>
                );
              }
              const next = cycle[(cycle.indexOf(v) + 1) % cycle.length];
              return (
                <button key={c} type="button" className={`pz-cell mark${bad.has(k) ? ' bad' : ''}`} disabled={readOnly} onClick={() => set(k, next)} aria-label={`row ${r + 1} column ${c + 1}: ${v === 'M' ? 'mine' : v === 'T' ? 'tent' : v === 'X' ? 'empty mark' : 'blank'}`}>
                  {v === 'M' && <span className="mine" />}
                  {v === 'T' && <span className="tent">⛺</span>}
                  {v === 'X' && <span className="xmark">✕</span>}
                </button>
              );
            })}
          </div>
        ))}
      </div>
      {!readOnly && <p className="pz-help">{mines ? 'Tap a square: once for a mine ●, again for ✕ (no mine), again to clear.' : 'Tap a square: once for a tent ⛺, again for ✕ (no tent), again to clear.'}</p>}
    </div>
  );
}

function LogicChart({ spec, cells, set, readOnly }: { spec: Extract<PuzzleSpec, { type: 'logicgrid' }>; cells: Cells; set: (k: string, v: string) => void; readOnly: boolean }) {
  const cols = spec.colGroups.flatMap((g, gi) => g.map((label) => ({ label, gi })));
  const rows = spec.rowGroups.flatMap((g, gi) => g.map((label) => ({ label, gi })));
  const cycle = ['', 'X', '✓'];
  return (
    <div className="pz pz-logic">
      <table>
        <thead>
          <tr>
            <th />
            {cols.map((c, i) => <th key={i} className={`lc-head${i > 0 && cols[i - 1].gi !== c.gi ? ' gstart' : ''}`}><span>{c.label}</span></th>)}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, ri) => (
            <tr key={ri} className={ri > 0 && rows[ri - 1].gi !== r.gi ? 'gstart' : ''}>
              <th className="lc-row">{r.label}</th>
              {cols.map((c, ci) => {
                // the combined chart has no block where a row group meets its own column group
                if (r.gi + c.gi >= spec.colGroups.length) return <td key={ci} className="lc-none" />;
                const k = key(ri, ci);
                const v = cells[k] ?? '';
                return (
                  <td key={ci} className={ci > 0 && cols[ci - 1].gi !== c.gi ? 'gstart' : ''}>
                    <button type="button" className={`lc-cell${v === '✓' ? ' yes' : v === 'X' ? ' no' : ''}`} disabled={readOnly} onClick={() => set(k, cycle[(cycle.indexOf(v) + 1) % cycle.length])} aria-label={`${r.label} and ${c.label}: ${v === '✓' ? 'yes' : v === 'X' ? 'no' : 'blank'}`}>
                      {v === 'X' ? '✕' : v}
                    </button>
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
      {!readOnly && <p className="pz-help">Tap a box: ✕ for "no", ✓ for "yes". Then fill in your answers below.</p>}
    </div>
  );
}
