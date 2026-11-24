import { useEffect, useRef, useState } from 'react';
import { PinRequired, checkProblem, fetchProblem, problemImageUrl, type ProblemView } from '../api';
import { Beast, Star } from './icons';
import { Confetti } from './CompleteDialog';

interface Props {
  level: number;
  chapter: number;
  n: number;
  list: number[]; // problems of this task that have content, in order
  onSolved: () => void;
  onOpen: (n: number) => void;
  onClose: () => void;
}

/**
 * One practice problem. Wrong answers keep the kid on the problem; from the second wrong answer
 * a hint (written from the official Beast Academy solution) is shown.
 */
export function ProblemDialog({ level, chapter, n, list, onSolved, onOpen, onClose }: Props) {
  const [p, setP] = useState<ProblemView | null>(null);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [solved, setSolved] = useState(false);
  const [shake, setShake] = useState(0);
  const [msg, setMsg] = useState<string | null>(null);
  const [hint, setHint] = useState<string | null>(null);
  const [wrongParts, setWrongParts] = useState<Set<string>>(new Set());
  const first = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let live = true;
    setP(null);
    setAnswers({});
    setSolved(false);
    setMsg(null);
    setHint(null);
    setWrongParts(new Set());
    fetchProblem(level, chapter, n)
      .then((v) => {
        if (!live) return;
        setP(v);
        setSolved(v.solved);
      })
      .catch((e) => {
        if (live) setMsg(e instanceof PinRequired ? 'Please reload and enter the PIN.' : 'Could not load this problem.');
      });
    return () => {
      live = false;
    };
  }, [level, chapter, n]);

  useEffect(() => {
    first.current?.focus();
    first.current?.select(); // after a wrong answer the kid can just type over it
  }, [p?.n, solved, shake]);

  const idx = list.indexOf(n);
  const nextN = idx >= 0 && idx < list.length - 1 ? list[idx + 1] : null;
  const allFilled = p ? p.parts.every((x) => (answers[x.label] ?? '').trim()) : false;

  const submit = async () => {
    if (!p || busy || !allFilled) return;
    setBusy(true);
    setMsg(null);
    try {
      const r = await checkProblem(level, chapter, n, answers);
      if (r.correct) {
        setSolved(true);
        setHint(null);
        onSolved();
      } else {
        setShake((s) => s + 1);
        setWrongParts(new Set((r.results ?? []).filter((x) => !x.ok).map((x) => x.label)));
        setMsg('Not quite. Try again!');
        if (r.hint) setHint(r.hint);
        else if (r.hintsLeft === false) setMsg('Not quite. You have used all of today’s hints for this one. Ask a grown-up for help!');
      }
    } catch {
      setMsg('Something went wrong. Try again.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="overlay" onClick={onClose} role="dialog" aria-modal="true" aria-label={`Problem ${n}`}>
      <div className="dialog problem" onClick={(e) => e.stopPropagation()}>
        {solved && <Confetti />}
        <button className="x-close" aria-label="Close" onClick={onClose}>{'✕'}</button>
        <div className="problem-head">
          <span className="coin big">{n}</span>
          <span className="problem-src">{p?.book ? `Book ${p.book}` : ''}{p?.page ? ` · page ${p.page}` : ''}</span>
        </div>
        {!p && !msg && <p className="what">Loading…</p>}
        {!p && msg && <p className="what">{msg}</p>}
        {p && (
          <>
            <div className="problem-prompt">{p.prompt}</div>
            {p.images.map((id) => (
              <img key={id} className="problem-img" src={problemImageUrl(id)} alt="Problem picture" />
            ))}
            {solved ? (
              <div className="problem-win">
                <Star size={64} />
                <h3>Correct!</h3>
                {nextN !== null ? (
                  <button className="bn primary" onClick={() => onOpen(nextN)}>Next problem {'›'}</button>
                ) : (
                  <button className="bn primary" onClick={onClose}>All done here!</button>
                )}
              </div>
            ) : (
              <form
                className={`answer-form${shake ? ' shake' : ''}`}
                key={shake}
                onSubmit={(e) => {
                  e.preventDefault();
                  void submit();
                }}
              >
                {p.parts.map((part, i) => (
                  <label key={part.label} className={`answer-row${wrongParts.has(part.label) ? ' bad' : ''}`}>
                    {p.parts.length > 1 && <span className="part-label">{part.label}</span>}
                    <input
                      ref={i === 0 ? first : undefined}
                      value={answers[part.label] ?? ''}
                      onChange={(e) => setAnswers({ ...answers, [part.label]: e.target.value })}
                      inputMode="text"
                      autoComplete="off"
                      autoCapitalize="off"
                      placeholder="Your answer"
                      aria-label={p.parts.length > 1 ? `Answer ${part.label}` : 'Your answer'}
                    />
                  </label>
                ))}
                {msg && <div className="problem-msg" role="status">{msg}</div>}
                {hint && (
                  <div className="hint">
                    <Beast className="hint-beast" />
                    <p>{hint}</p>
                  </div>
                )}
                <button className="bn primary" type="submit" disabled={!allFilled || busy}>{busy ? 'Checking…' : 'Check'}</button>
              </form>
            )}
          </>
        )}
      </div>
    </div>
  );
}
