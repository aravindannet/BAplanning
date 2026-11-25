import { useState } from 'react';
import { key, type Cells, type PuzzleSpec } from '../../../netlify/functions/_puzzle';

type P<T extends PuzzleSpec['type']> = { spec: Extract<PuzzleSpec, { type: T }>; cells: Cells; bad: Set<string>; readOnly: boolean; onChange: (c: Cells) => void };

const BLOB_COLORS = ['#ffd23f', '#9fd8f5', '#b6e59e', '#f7b2d0', '#c9b8f2', '#ffc49a', '#a8e6da', '#f4e285', '#d0d6e0', '#f5a3a3'];

/** Factor Blobs: tap squares to pick them, then "Make blob". Tap a blob to break it apart. */
export function BlobBoard({ spec, cells, bad, readOnly, onChange }: P<'blobs'>) {
  const [picked, setPicked] = useState<string[]>([]);
  const ids = [...new Set(Object.values(cells).filter(Boolean))];
  const color = (id: string) => BLOB_COLORS[(Number(id) - 1) % BLOB_COLORS.length];
  const tap = (k: string) => {
    if (readOnly) return;
    const id = cells[k];
    if (id) {
      // break the whole blob apart
      onChange(Object.fromEntries(Object.entries(cells).map(([kk, v]) => [kk, v === id ? '' : v])));
      return;
    }
    setPicked((p) => (p.includes(k) ? p.filter((x) => x !== k) : [...p, k]));
  };
  const make = () => {
    const next = String(Math.max(0, ...ids.map(Number)) + 1);
    onChange({ ...cells, ...Object.fromEntries(picked.map((k) => [k, next])) });
    setPicked([]);
  };
  const product = picked.reduce((a, k) => { const [r, c] = k.split(',').map(Number); return a * spec.nums[r][c]; }, 1);
  return (
    <div className="pz pz-blobs">
      <div className="pz-target">Target: <b>{spec.target}</b></div>
      <div className="pz-table" role="grid">
        {spec.nums.map((row, r) => (
          <div className="pz-row" key={r} style={{ ['--n' as string]: row.length }}>
            {row.map((v, c) => {
              const k = key(r, c);
              const id = cells[k];
              const same = (rr: number, cc: number) => id && cells[key(rr, cc)] === id;
              const cls = ['pz-cell', 'blob', id ? 'in' : '', picked.includes(k) ? 'sel' : '', bad.has(k) ? 'bad' : '',
                id && !same(r - 1, c) ? 'bt' : '', id && !same(r + 1, c) ? 'bb' : '', id && !same(r, c - 1) ? 'bl' : '', id && !same(r, c + 1) ? 'br' : ''].filter(Boolean).join(' ');
              return (
                <button key={c} type="button" className={cls} style={id ? { background: color(id) } : undefined} disabled={readOnly} onClick={() => tap(k)} aria-label={`${v}${id ? `, in blob ${id}` : picked.includes(k) ? ', picked' : ''}`}>
                  <span className="v">{v}</span>
                </button>
              );
            })}
          </div>
        ))}
      </div>
      {!readOnly && (
        <div className="blob-bar">
          <span className="pz-help">{picked.length ? `Picked: ${picked.length} square${picked.length > 1 ? 's' : ''} · product ${product}` : 'Tap touching squares, then make a blob. Tap a blob to undo it.'}</span>
          <button type="button" className="bn blob-make" disabled={picked.length < 2} onClick={make}>Make blob</button>
        </div>
      )}
    </div>
  );
}

/** Pyramid Descent: tap one square in each row; each must touch the one above. */
export function PyramidBoard({ spec, cells, bad, readOnly, onChange }: P<'pyramid'>) {
  const tap = (r: number, c: number) => {
    if (readOnly) return;
    const k = key(r, c);
    const on = cells[k] === 'P';
    const next = { ...cells };
    spec.rows[r].forEach((_, cc) => (next[key(r, cc)] = ''));
    if (!on) next[k] = 'P';
    onChange(next);
  };
  return (
    <div className="pz pz-pyramid">
      <div className="pz-target">Product: <b>{spec.target}</b></div>
      <div className="pyr">
        {spec.rows.map((row, r) => (
          <div className="pyr-row" key={r}>
            {row.map((v, c) => {
              const k = key(r, c);
              return (
                <button key={c} type="button" className={`pz-cell pyr-cell${cells[k] === 'P' ? ' on' : ''}${bad.has(k) ? ' bad' : ''}`} disabled={readOnly} onClick={() => tap(r, c)} aria-label={`row ${r + 1}: ${v}${cells[k] === 'P' ? ', on the path' : ''}`}>
                  <span className="v">{v}</span>
                </button>
              );
            })}
          </div>
        ))}
      </div>
      {!readOnly && <p className="pz-help">Tap one square in each row, from the top down. Each square must touch the one above it.</p>}
    </div>
  );
}

/** Times Table: tap an empty box and type its number with the pad (any number of digits). */
export function TimesTableBoard({ spec, cells, bad, readOnly, onChange }: P<'timestable'>) {
  const [sel, setSel] = useState<string | null>(null);
  const type = (d: string) => {
    if (!sel) return;
    const cur = cells[sel] ?? '';
    onChange({ ...cells, [sel]: d === '⌫' ? cur.slice(0, -1) : (cur + d).replace(/^0+/, '').slice(0, 4) });
  };
  return (
    <div className="pz pz-times" style={{ ['--n' as string]: spec.cols + 1 }}>
      <div className="pz-table" role="grid">
        {[...Array(spec.rows + 1)].map((_, r) => (
          <div className="pz-row" key={r}>
            {[...Array(spec.cols + 1)].map((__, c) => {
              const k = key(r, c);
              if (!r && !c) return <span key={c} className="pz-cell tt-corner">×</span>;
              const given = spec.givens[k];
              const head = !r || !c;
              const cls = ['pz-cell', 'tt', head ? 'head' : '', given ? 'given' : '', sel === k && !readOnly ? 'sel' : '', bad.has(k) ? 'bad' : ''].filter(Boolean).join(' ');
              return (
                <button key={c} type="button" className={cls} disabled={readOnly || !!given} onClick={() => setSel(k)} aria-label={`${head ? 'factor' : 'product'} ${given || cells[k] || 'empty'}`}>
                  <span className="v">{given || cells[k] || ''}</span>
                </button>
              );
            })}
          </div>
        ))}
      </div>
      {!readOnly && (
        <div className="numpad digits" role="group" aria-label="Number pad">
          {['1', '2', '3', '4', '5', '6', '7', '8', '9', '0', '⌫'].map((d) => (
            <button key={d} type="button" className={`numkey${d === '⌫' ? ' erase' : ''}`} disabled={!sel} onClick={() => type(d)} aria-label={d === '⌫' ? 'Erase' : d}>{d}</button>
          ))}
        </div>
      )}
    </div>
  );
}

/** Sieve of Eratosthenes: tap a number to circle it, again to cross it out, again to clear. */
export function SieveBoard({ spec, cells, readOnly, onChange }: P<'sieve'>) {
  const cycle = ['', 'O', 'X'];
  const start = Math.floor((spec.from - 1) / 10) * 10 + 1;
  const rows = Math.ceil((spec.to - start + 1) / 10);
  const left = spec.to - spec.from + 1 - Object.values(cells).filter(Boolean).length;
  return (
    <div className="pz pz-sieve">
      <div className="sieve">
        {[...Array(rows * 10)].map((_, i) => {
          const n = start + i;
          if (n < spec.from || n > spec.to) return <span key={i} className="sv-cell empty" />;
          const v = cells[String(n)] ?? '';
          return (
            <button key={i} type="button" className={`sv-cell${v === 'O' ? ' circ' : v === 'X' ? ' cross' : ''}`} disabled={readOnly} onClick={() => onChange({ ...cells, [String(n)]: cycle[(cycle.indexOf(v) + 1) % 3] })} aria-label={`${n}${v === 'O' ? ', circled' : v === 'X' ? ', crossed out' : ''}`}>
              {n}
            </button>
          );
        })}
      </div>
      {!readOnly && <p className="pz-help">Tap once to circle ○, twice to cross out ✕. {left > 0 ? `${left} numbers left to mark.` : 'Every number is marked!'}</p>}
    </div>
  );
}
