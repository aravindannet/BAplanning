import { useRef, useState } from 'react';
import { key, linkPaths, mazePath, starLines, unkey, type Cells, type PuzzleSpec } from '../../../netlify/functions/_puzzle';
import { Frac } from '../MathText';

type P<T extends PuzzleSpec['type']> = { spec: Extract<PuzzleSpec, { type: T }>; cells: Cells; bad: Set<string>; readOnly: boolean; onChange: (c: Cells) => void };

const PATH_COLORS = ['#e8833a', '#2f9e8f', '#7a5cc7', '#d24d6c', '#3d7fd1', '#8aa833', '#c99a17', '#5c6f84', '#b5562e', '#1f8fb3'];
const LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
const adjacent = (a: string, b: string) => { const [r1, c1] = unkey(a), [r2, c2] = unkey(b); return Math.abs(r1 - r2) + Math.abs(c1 - c2) === 1; };

/** The arms that join a path square to the squares before and after it (drawn as thick lines). */
function arms(path: string[], k: string): ('up' | 'down' | 'left' | 'right')[] {
  const i = path.indexOf(k);
  if (i < 0) return [];
  const [r, c] = unkey(k);
  return [path[i - 1], path[i + 1]].filter(Boolean).map((n) => {
    const [r2, c2] = unkey(n!);
    return r2 < r ? 'up' : r2 > r ? 'down' : c2 < c ? 'left' : 'right';
  });
}
function Arms({ dirs, color, dot }: { dirs: string[]; color: string; dot?: boolean }) {
  return (
    <>
      {dirs.map((d) => <span key={d} className={`pl-arm ${d}`} style={{ background: color }} />)}
      {dot && <span className="pl-dot" style={{ background: color }} />}
    </>
  );
}

/** Lets a finger (or the pencil) drag across squares: every square the pointer enters counts as a tap. */
function useDrag(onEnter: (k: string) => void) {
  const down = useRef(false);
  const last = useRef<string | null>(null);
  return {
    onPointerDown: () => { down.current = true; last.current = null; },
    onPointerUp: () => { down.current = false; },
    onPointerLeave: () => { down.current = false; },
    onPointerMove: (e: React.PointerEvent) => {
      if (!down.current) return;
      const el = document.elementFromPoint(e.clientX, e.clientY)?.closest('[data-k]') as HTMLElement | null;
      const k = el?.dataset.k;
      if (k && k !== last.current) { last.current = k; onEnter(k); }
    },
  };
}

/**
 * Fraction-Sum Link: tap (or drag from) a number, go square by square, and finish on its partner.
 * Tapping a finished path's number or square removes that path; tapping the square before the end backs up.
 */
export function SumLinkBoard({ spec, cells, readOnly, onChange }: P<'sumlink'>) {
  const [cur, setCur] = useState<string | null>(null); // the path being drawn
  const paths = linkPaths(cells);
  const pathOf = (k: string) => { const v = (cells[k] ?? '').trim(); return v ? v[0] : null; };
  const color = (id: string) => PATH_COLORS[LETTERS.indexOf(id) % PATH_COLORS.length];
  const without = (id: string) => Object.fromEntries(Object.entries(cells).filter(([, v]) => !(v ?? '').startsWith(id)));
  const done = (id: string) => { const ks = paths.get(id) ?? []; return ks.length >= 2 && !!spec.nums[ks[0]] && !!spec.nums[ks[ks.length - 1]]; };

  const step = (k: string, fromDrag = false) => {
    if (readOnly) return;
    const mine = pathOf(k);
    if (cur) {
      const ks = paths.get(cur) ?? [];
      const end = ks[ks.length - 1];
      if (k === end) return;
      if (ks.length >= 2 && k === ks[ks.length - 2]) { onChange({ ...cells, [end]: '' }); return; } // back up one square
      if (!mine && end && adjacent(end, k)) {
        onChange({ ...cells, [k]: `${cur}${ks.length}` });

        if (spec.nums[k]) setCur(null); // reached a number: the path is finished
        return;
      }
      if (fromDrag) return;
    }
    if (mine) { // tap a path to rub it out
      onChange(without(mine));
      setCur(null);
      return;
    }
    if (spec.nums[k]) { // start a new path from this number
      const id = [...LETTERS].find((l) => !paths.has(l)) ?? 'Z';
      onChange({ ...cells, [k]: `${id}0` });
      setCur(id);

    } else setCur(null);
  };
  const drag = useDrag((k) => step(k, true));

  return (
    <div className="pz pz-link">
      <div className="pz-target">Target sum: <b>{spec.target}</b></div>
      <div className="pz-table" role="grid" style={{ ['--n' as string]: spec.cols }} {...drag}>
        {[...Array(spec.rows)].map((_, r) => (
          <div className="pz-row" key={r}>
            {[...Array(spec.cols)].map((__, c) => {
              const k = key(r, c);
              const id = pathOf(k);
              const num = spec.nums[k];
              const ks = id ? paths.get(id) ?? [] : [];
              const cls = ['pz-cell', 'pl-cell', num ? 'num' : '', id ? 'in' : '', id && id === cur ? 'cur' : '', id && done(id) ? 'done' : ''].filter(Boolean).join(' ');
              return (
                <button key={c} type="button" data-k={k} className={cls} disabled={readOnly} onClick={() => step(k)} style={id && num ? { borderColor: color(id) } : undefined}
                  aria-label={`${num ? `number ${num}` : `row ${r + 1} column ${c + 1}`}${id ? ', on a path' : ''}`}>
                  {id && <Arms dirs={arms(ks, k)} color={color(id)} dot={!num} />}
                  {num && <span className="v pl-num"><Frac v={num} /></span>}
                </button>
              );
            })}
          </div>
        ))}
      </div>
      {!readOnly && <p className="pz-help">{cur ? 'Keep going square by square to a partner number. Tap the square behind you to back up.' : 'Tap a number, then tap (or drag) square by square to the number it adds with. Tap a path to rub it out.'}</p>}
    </div>
  );
}

/** Constellation: tap one dot, then another, to draw (or rub out) a straight line between them. */
export function ConstellationBoard({ spec, cells, bad, readOnly, onChange }: P<'constellation'>) {
  const [sel, setSel] = useState<number | null>(null);
  const xs = spec.dots.map((d) => d.x), ys = spec.dots.map((d) => d.y);
  const minX = Math.min(...xs), maxX = Math.max(...xs), minY = Math.min(...ys), maxY = Math.max(...ys);
  const pad = 0.12 * Math.max(maxX - minX, maxY - minY, 1);
  const W = maxX - minX + 2 * pad, H = maxY - minY + 2 * pad;
  const px = (x: number) => ((x - minX + pad) / W) * 100, py = (y: number) => ((y - minY + pad) / H) * 100;
  const lines = starLines(cells);
  const tap = (i: number) => {
    if (readOnly) return;
    if (sel === null) { setSel(i); return; }
    if (sel === i) { setSel(null); return; }
    const k = `${Math.min(sel, i)}-${Math.max(sel, i)}`;
    onChange({ ...cells, [k]: cells[k] === '1' ? '' : '1' });

    setSel(null);
  };
  return (
    <div className="pz pz-star">
      <div className="st-sky" style={{ aspectRatio: `${W} / ${H}` }}>
        <svg viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
          {lines.filter(([i, j]) => spec.dots[i] && spec.dots[j]).map(([i, j]) => (
            <line key={`${i}-${j}`} x1={px(spec.dots[i].x)} y1={py(spec.dots[i].y)} x2={px(spec.dots[j].x)} y2={py(spec.dots[j].y)} className={bad.has(`${i}-${j}`) ? 'bad' : ''} vectorEffect="non-scaling-stroke" />
          ))}
        </svg>
        {spec.dots.map((d, i) => (
          <button key={i} type="button" className={`st-dot${sel === i ? ' sel' : ''}`} style={{ left: `${px(d.x)}%`, top: `${py(d.y)}%` }} disabled={readOnly} onClick={() => tap(i)} aria-label={`dot ${d.v}${sel === i ? ', picked' : ''}`}>
            <span className="st-pin" />
            <span className="st-label"><Frac v={d.v} /></span>
          </button>
        ))}
      </div>
      {!readOnly && <p className="pz-help">{sel !== null ? 'Now tap the dot to join it to (tap a joined pair again to rub the line out).' : 'Tap a dot, then another dot with the same value, to draw a line. Lines may not cross.'}</p>}
    </div>
  );
}

/** Maze Escape: start on the shaded square and tap square by square to the exit. Tap a square on the path to go back to it. */
export function MazeBoard({ spec, cells, readOnly, onChange }: P<'maze'>) {
  const path = mazePath(cells);
  const toPath = (ks: string[]) => onChange(Object.fromEntries(ks.map((k, i) => [k, String(i + 1)])));
  const step = (k: string, fromDrag = false) => {
    if (readOnly) return;
    const at = path.indexOf(k);
    if (at >= 0) { if (!fromDrag) toPath(path.slice(0, at === path.length - 1 ? at : at + 1)); return; } // back up
    if (!path.length) { if (k === spec.start) { toPath([k]); } return; }
    if (adjacent(path[path.length - 1], k)) { toPath([...path, k]); }
  };
  const drag = useDrag((k) => step(k, true));
  const cols = spec.nums[0].length;
  return (
    <div className="pz pz-maze">
      <div className={`mz-wrap exit-${spec.exitSide}`}>
        <div className="pz-table" role="grid" style={{ ['--n' as string]: cols }} {...drag}>
          {spec.nums.map((row, r) => (
            <div className="pz-row" key={r}>
              {row.map((v, c) => {
                const k = key(r, c);
                const start = k === spec.start, exit = k === spec.exit;
                const cls = ['pz-cell', 'pl-cell', 'mz-cell', start ? 'start' : '', exit ? `exit exit-${spec.exitSide}` : '', path.includes(k) ? 'in' : ''].filter(Boolean).join(' ');
                const dirs = arms(path, k);
                if (exit && path[path.length - 1] === k) dirs.push(spec.exitSide === 'top' ? 'up' : spec.exitSide === 'bottom' ? 'down' : spec.exitSide);
                return (
                  <button key={c} type="button" data-k={k} className={cls} disabled={readOnly} onClick={() => step(k)} aria-label={`${v}${start ? ', start' : ''}${exit ? ', next to the exit' : ''}${path.includes(k) ? ', on your path' : ''}`}>
                    {path.includes(k) && <Arms dirs={dirs} color="#e8833a" />}
                    <span className="v mz-num"><Frac v={v} /></span>
                  </button>
                );
              })}
            </div>
          ))}
        </div>
      </div>
      {!readOnly && <p className="pz-help">{path.length ? 'Tap the next square up, down, left or right. Tap a square on your path to go back to it.' : 'Start on the shaded square, then skip-count square by square to the exit (the striped edge).'}</p>}
    </div>
  );
}
