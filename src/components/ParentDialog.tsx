import { useState } from 'react';
import { Stars } from './icons';
import { solutionImageUrl, type ParentItem } from '../api';

const fmt = (iso: string) => new Date(iso).toLocaleString([], { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
const ans = (a?: Record<string, string>) => Object.entries(a ?? {}).map(([k, v]) => (k === 'answer' ? v : `${k}: ${v}`)).join(' · ');

/** Parent review: official solution, number of tries, and every wrong answer and hint, per problem. */
export function ParentDialog({ level, chapter, code, items, total, onReset, onClose }: { level: number; chapter: number; code: string; items: ParentItem[]; total: number; onReset: (n: number) => Promise<void>; onClose: () => void }) {
  const [open, setOpen] = useState<number | null>(null);
  const solved = items.filter((i) => i.solved).length;
  const tries = items.reduce((n, i) => n + i.tries, 0);
  const hints = items.reduce((n, i) => n + i.history.filter((h) => h.hint).length, 0);
  return (
    <div className="overlay" onClick={onClose} role="dialog" aria-modal="true" aria-label="Parent area">
      <div className="dialog parent" onClick={(e) => e.stopPropagation()}>
        <button className="x-close" aria-label="Close" onClick={onClose}>{'\u2715'}</button>
        <div className="problem-head">
          <span className="learn-title">👪 Parent review</span>
          <span className="problem-src">Level {level} · Chapter {chapter}</span>
        </div>
        <div className="parent-summary">
          <span><b>{solved}</b> solved</span>
          <span><b>{items.length}</b> of {total} tried</span>
          <span><b>{tries}</b> wrong answers</span>
          <span><b>{hints}</b> hints given</span>
        </div>
        <div className="parent-list">
          {items.length === 0 && <p className="what">Nothing has been tried yet.</p>}
          {items.map((it) => (
            <div key={it.n} className={`parent-row${open === it.n ? ' open' : ''}`}>
              <button className="parent-head" onClick={() => setOpen(open === it.n ? null : it.n)}>
                <span className={`coin${it.solved ? ' solved' : ''}`} style={{ animation: 'none' }}>{it.n}</span>
                <span className="parent-prompt">{it.prompt.split('\n')[0]}</span>
                {it.solved && <Stars earned={it.stars} size={14} />}
                <span className={`pill ${it.solved ? 'ok' : 'todo'}`}>{it.solved ? 'Solved' : 'Not solved'}</span>
                <span className="pill">{it.tries} {it.tries === 1 ? 'try' : 'tries'}</span>
              </button>
              {open === it.n && (
                <div className="parent-body">
                  <h4>History</h4>
                  <ol className="timeline">
                    {it.history.map((h, i) => (
                      <li key={i} className={h.kind}>
                        <span className="when">{fmt(h.at)}</span>
                        <span>
                          {h.kind === 'solved' ? '✓ Solved' : '✗ Wrong'}: <b>{ans(h.answers)}</b>
                          {h.hint && <em className="given-hint">Hint shown: “{h.hint}”</em>}
                        </span>
                      </li>
                    ))}
                  </ol>
                  <h4>Answer</h4>
                  <p className="parent-ans">{it.answer}</p>
                  <h4>Official solution</h4>
                  <p className="parent-sol">{it.solution}</p>
                  {it.solutionImages.map((id) => <img key={id} className="problem-img" src={solutionImageUrl(id, code)} alt="Solution" />)}
                  <button className="link" onClick={() => { if (confirm(`Reset problem ${it.n}? This clears its tries and history.`)) void onReset(it.n); }}>Reset problem {it.n}</button>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
