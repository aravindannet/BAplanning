import { useEffect, useRef, useState } from 'react';
import { PinRequired, checkProblem, fetchProblem, fetchReview, problemImageUrl, solutionImageUrl, type ProblemView, type Review } from '../api';
import { Beast, Medal, Star } from './icons';
import { Confetti } from './CompleteDialog';

interface Props {
  level: number;
  chapter: number;
  n: number;
  list: { n: number; optional: boolean }[]; // problems of this task that have content, in order
  onSolved: () => void;
  onOpen: (n: number) => void;
  onClose: () => void;
}

const fmtTime = (iso: string) => new Date(iso).toLocaleString([], { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
const fmtAnswers = (a?: Record<string, string>) => Object.entries(a ?? {}).map(([k, v]) => (k === 'answer' ? v : `${k}: ${v}`)).join(' · ');

/**
 * One practice problem. Wrong answers keep the kid on the problem; from the second wrong answer
 * a hint (written from the official Beast Academy solution) is shown.
 */
export function ProblemDialog({ level, chapter, n, list, onSolved, onOpen, onClose }: Props) {
  const [p, setP] = useState<ProblemView | null>(null);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [solved, setSolved] = useState(false);
  const [stars, setStars] = useState(3);
  const [shake, setShake] = useState(0);
  const [msg, setMsg] = useState<string | null>(null);
  const [hint, setHint] = useState<string | null>(null);
  const [wrongParts, setWrongParts] = useState<Set<string>>(new Set());
  const first = useRef<HTMLInputElement>(null);
  const [justSolved, setJustSolved] = useState(false); // confetti only for a fresh solve, not when re-opening
  const [showReview, setShowReview] = useState(false);
  const [review, setReview] = useState<Review | null>(null);
  const [reviewErr, setReviewErr] = useState(false);

  useEffect(() => {
    let live = true;
    setP(null);
    setAnswers({});
    setSolved(false);
    setMsg(null);
    setHint(null);
    setWrongParts(new Set());
    setJustSolved(false);
    setShowReview(false);
    setReview(null);
    setReviewErr(false);
    fetchProblem(level, chapter, n)
      .then((v) => {
        if (!live) return;
        setP(v);
        setSolved(v.solved);
        if (v.solved) setShowReview(true); // opening a solved problem shows its solution and history right away
      })
      .catch((e) => {
        if (live) setMsg(e instanceof PinRequired ? 'Please reload and enter the PIN.' : (e as Error).message === 'locked' ? 'This one is locked. Finish the earlier problems (and Learn) first!' : 'Could not load this problem.');
      });
    return () => {
      live = false;
    };
  }, [level, chapter, n]);

  // load the official solution + every try once it is asked for (the server only gives it for solved problems)
  useEffect(() => {
    if (!showReview || !solved || review) return;
    let live = true;
    fetchReview(level, chapter, n)
      .then((r) => {
        if (!live) return;
        setReview(r);
        setStars(r.stars);
      })
      .catch(() => live && setReviewErr(true));
    return () => {
      live = false;
    };
  }, [showReview, solved, review, level, chapter, n]);

  useEffect(() => {
    first.current?.focus();
    first.current?.select(); // after a wrong answer the kid can just type over it
  }, [p?.n, solved, shake]);

  const idx = list.findIndex((x) => x.n === n);
  const next = idx >= 0 && idx < list.length - 1 ? list[idx + 1] : null;
  const afterNext = next?.optional && idx + 2 < list.length ? list[idx + 2] : null; // dashed problems may be skipped
  const allFilled = p ? p.parts.every((x) => (answers[x.label] ?? '').trim()) : false;

  const submit = async () => {
    if (!p || busy || !allFilled) return;
    setBusy(true);
    setMsg(null);
    try {
      const r = await checkProblem(level, chapter, n, answers);
      if (r.correct) {
        setStars(r.stars ?? 3);
        setSolved(true);
        setJustSolved(true);
        setReview(null);
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
        {solved && justSolved && <Confetti />}
        <button className="x-close" aria-label="Close" onClick={onClose}>{'✕'}</button>
        <div className="problem-head">
          <span className="coin big"><Medal n={n} kind={solved ? 'green' : 'gold'} /></span>
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
                <div className="win-stars">{[0, 1, 2].map((i) => <Star key={i} size={i === 1 ? 72 : 56} dim={i >= stars} />)}</div>
                <h3>{stars === 3 ? 'Perfect!' : 'Correct!'}</h3>
                {next ? (
                  <>
                    <button className="bn primary" onClick={() => onOpen(next.n)}>{next.optional ? 'Try the dashed one' : 'Next problem'} {'›'}</button>
                    {afterNext && <button className="link" onClick={() => onOpen(afterNext.n)}>Skip the dashed one {'›'}</button>}
                  </>
                ) : (
                  <button className="bn primary" onClick={onClose}>All done here!</button>
                )}
                <button className="bn ghost" onClick={() => setShowReview((v) => !v)} aria-expanded={showReview}>
                  {showReview ? 'Hide solution' : '📖 Show solution'}
                </button>
                {showReview && (
                  <div className="review">
                    {reviewErr && <p className="what">Could not load the solution.</p>}
                    {!review && !reviewErr && <p className="what">Loading…</p>}
                    {review && (
                      <>
                        <div className="review-pills">
                          <span className="pill">{review.tries} {review.tries === 1 ? 'wrong answer' : 'wrong answers'}</span>
                          <span className="pill">{review.history.filter((h) => h.hint).length} hints</span>
                        </div>
                        <h4>Tries</h4>
                        <ol className="timeline">
                          {review.history.map((h, i) => (
                            <li key={i} className={h.kind}>
                              <span className="when">{fmtTime(h.at)}</span>
                              <span>
                                {h.kind === 'solved' ? '✓ Right' : '✗ Wrong'}: <b>{fmtAnswers(h.answers)}</b>
                                {h.hint && <em className="given-hint">Hint: “{h.hint}”</em>}
                              </span>
                            </li>
                          ))}
                        </ol>
                        <h4>Answer</h4>
                        <p className="parent-ans">{review.answer}</p>
                        <h4>Solution</h4>
                        <p className="parent-sol">{review.solution}</p>
                        {review.solutionImages.map((id) => <img key={id} className="problem-img" src={solutionImageUrl(id)} alt="Solution" />)}
                      </>
                    )}
                  </div>
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
