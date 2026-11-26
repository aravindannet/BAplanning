import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { PinRequired, checkProblem, fetchProblem, fetchReview, problemImageUrl, solutionImageUrl, type GivenHint, type ProblemView, type Review } from '../api';
import { Beast, Medal, Star, Heart, Bulb } from './icons';
import { Confetti } from './CompleteDialog';
import { PuzzleBoard } from './puzzles/PuzzleBoard';
import { ChoicePicker } from './puzzles/ChoicePicker';
import { NumberPad } from './NumberPad';
import { EMPTY_FRAC, applyKey, fracText, isFracPad, type FracBoxes } from '../pad';
import { MathText, copyPlainFractions } from './MathText';
import { play, useWindowSound } from '../sound';
import { RoughNote, RoughThumb } from './RoughNote';
import type { Cells } from '../../netlify/functions/_puzzle';

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
const fmtAnswers = (a?: Record<string, string>, cells?: Cells) => {
  const text = Object.entries(a ?? {}).map(([k, v]) => (k === 'answer' ? v : `${k}: ${v}`)).join(' · ');
  if (!cells) return text;
  const filled = Object.values(cells).filter((v) => v && v.toUpperCase() !== 'X').length;
  return `${text ? `${text} · ` : ''}board with ${filled} square${filled === 1 ? '' : 's'} filled`;
};
/** Short choices become big buttons; long lists become a dropdown. */
const asButtons = (choices: string[]) => choices.length <= 6 && choices.every((c) => c.length <= 14);

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
  // every hint given for this problem (oldest first); the newest is shown, the rest behind "Earlier hints"
  const [hints, setHints] = useState<GivenHint[]>([]);
  const [showEarlier, setShowEarlier] = useState(false);
  // lives: every wrong answer breaks one of 2 hearts; every hint lights one of 3 bulbs
  const [wrong, setWrong] = useState(0);
  const [bump, setBump] = useState<{ heart: boolean; bulb: boolean } | null>(null); // the icons that just changed animate
  const latest = hints.length ? hints[hints.length - 1] : null;
  const [cells, setCells] = useState<Cells>({});
  const [wrongParts, setWrongParts] = useState<Set<string>>(new Set());
  const first = useRef<HTMLInputElement>(null);
  // number-pad answers: the pad types into the box last tapped (the first one to start with)
  const inputs = useRef<Record<string, HTMLInputElement | null>>({});
  const [active, setActive] = useState<string | null>(null);
  // fraction answers: three boxes per part (whole, top, bottom); the pad types into the box last tapped
  const [frac, setFrac] = useState<Record<string, FracBoxes>>({});
  const [fracBox, setFracBox] = useState<keyof FracBoxes>('w');
  const setFracPart = (label: string, b: FracBoxes) => {
    setFrac((f) => ({ ...f, [label]: b }));
    setAnswers((a) => ({ ...a, [label]: fracText(b) }));
  };
  /** One of the three boxes of a fraction answer (the pad types into the one last tapped; a real keyboard types too). */
  const fracInput = (label: string, box: keyof FracBoxes, isFirst = false) => {
    const b = frac[label] ?? EMPTY_FRAC;
    const on = (active ?? padParts[0]?.label) === label && fracBox === box;
    return (
      <input
        ref={isFirst ? (el) => { first.current = el; } : undefined}
        className={`frac-box ${box}${on ? ' on' : ''}`}
        value={b[box]}
        onChange={(e) => setFracPart(label, { ...b, [box]: e.target.value.replace(/\D/g, '').slice(0, 4) })}
        onFocus={() => {
          setActive(label);
          setFracBox(box);
        }}
        inputMode="none"
        autoComplete="off"
        aria-label={box === 'w' ? 'whole number' : box === 'n' ? 'top of the fraction' : 'bottom of the fraction'}
      />
    );
  };
  // The problem must fit on screen without scrolling: step the size down until it does (the solution
  // panel, once opened, may scroll). Re-fit when the content or the window changes.
  const dlg = useRef<HTMLDivElement>(null);
  const [fit, setFit] = useState(0);
  const [fitEpoch, setFitEpoch] = useState(0);
  // rough-note page: the window flips over like a card
  const [notes, setNotes] = useState(false);
  const [flip, setFlip] = useState<'out' | 'in' | null>(null);
  const [flipped, setFlipped] = useState(false); // after the first flip, the opening animation must not replay
  useWindowSound(n); // pop on open and on moving to the next problem, pop-down on close
  const flipTo = (show: boolean) => {
    if (flip) return;
    play('flip');
    setFlip('out');
    setFlipped(true);
    window.setTimeout(() => {
      setNotes(show);
      setFlip('in');
      window.setTimeout(() => setFlip(null), 190);
    }, 190);
  };
  const [justSolved, setJustSolved] = useState(false); // confetti only for a fresh solve, not when re-opening
  const [showReview, setShowReview] = useState(false);
  const [review, setReview] = useState<Review | null>(null);
  const [reviewErr, setReviewErr] = useState(false);

  useEffect(() => {
    let live = true;
    setP(null);
    setAnswers({});
    setCells({});
    setSolved(false);
    setMsg(null);
    setHints([]);
    setShowEarlier(false);
    setActive(null);
    setFrac({});
    setFracBox('w');
    setWrong(0);
    setBump(null);
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
        setHints(v.hints ?? []);
        setWrong(v.attempts ?? 0);
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

  const SCALES = [1, 0.92, 0.85, 0.78, 0.72, 0.66, 0.6, 0.55];
  const contentKey = `${p?.n}|${solved}|${hints.length}|${showEarlier}|${msg ?? ''}|${showReview}|${wrongParts.size}|${notes}`;
  useEffect(() => {
    setFit(0);
    setFitEpoch((e) => e + 1);
  }, [contentKey]);
  useEffect(() => {
    const onResize = () => {
      setFit(0);
      setFitEpoch((e) => e + 1);
    };
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);
  useLayoutEffect(() => {
    const el = dlg.current;
    if (!el || notes || (solved && showReview)) return;
    if (el.scrollHeight > el.clientHeight + 1 && fit < SCALES.length - 1) setFit(fit + 1);
  }, [fit, fitEpoch, solved, showReview, notes]);

  const idx = list.findIndex((x) => x.n === n);
  const next = idx >= 0 && idx < list.length - 1 ? list[idx + 1] : null;
  const afterNext = next?.optional && idx + 2 < list.length ? list[idx + 2] : null; // dashed problems may be skipped
  const board = p?.kind === 'puzzle' && p.puzzle && p.puzzle.type !== 'logicgrid';
  const allFilled = p ? (board ? Object.values(cells).some((v) => v) : true) && p.parts.every((x) => (answers[x.label] ?? '').trim()) : false;

  const padParts = p?.parts.filter((x) => x.pad) ?? [];
  const padPart = padParts.find((x) => x.label === active) ?? padParts[0];
  const pressKey = (k: string) => {
    if (!padPart) return;
    if (isFracPad(padPart.pad)) {
      const b = frac[padPart.label] ?? EMPTY_FRAC;
      const cur = b[fracBox];
      setFracPart(padPart.label, { ...b, [fracBox]: k === '⌫' ? cur.slice(0, -1) : (cur + k).slice(0, 4) });
      return;
    }
    const el = inputs.current[padPart.label];
    const cur = answers[padPart.label] ?? '';
    let start = el?.selectionStart ?? cur.length, end = el?.selectionEnd ?? cur.length;
    if (document.activeElement !== el) start = end = cur.length; // not focused: add at the end
    let text = cur.slice(0, start) + cur.slice(end), caret = start; // typing replaces a selection
    if (!(k === '⌫' && start !== end)) ({ text, caret } = applyKey(text, caret, k));
    setAnswers((a) => ({ ...a, [padPart.label]: text }));
    requestAnimationFrame(() => {
      el?.focus({ preventScroll: true });
      el?.setSelectionRange(caret, caret);
    });
  };

  const submit = async () => {
    if (!p || busy || !allFilled) return;
    setBusy(true);
    setMsg(null);
    try {
      const r = await checkProblem(level, chapter, n, answers, p.kind === 'puzzle' ? cells : undefined);
      if (r.correct) {
        play('correct');
        setStars(r.stars ?? 3);
        setSolved(true);
        setJustSolved(true);
        setReview(null);
        setHints([]);
        onSolved();
      } else {
        play('wrong');
        setShake((s) => s + 1);
        setWrong((w) => w + 1);
        setBump({ heart: wrong + 1 <= 2, bulb: Boolean(r.hint) && hints.length < 3 });
        window.setTimeout(() => setBump(null), 1200);
        setWrongParts(new Set((r.results ?? []).filter((x) => !x.ok).map((x) => x.label)));
        setMsg(p.kind === 'explain' ? 'Not quite yet. Look at the hint and try again!' : 'Not quite. Try again!');
        if (r.hint) {
          const given = { hint: r.hint, hintFrom: r.hintFrom, at: new Date().toISOString() };
          window.setTimeout(() => play('hint'), 550); // after the wrong-answer boop
          setHints((h) => [...h, given]);
        }
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
      <div ref={dlg} className={`dialog problem${solved && showReview && !notes ? ' scrolls' : ''}${notes ? ' notes' : ''}${flip ? ` flip-${flip}` : ''}${flipped ? ' settled' : ''}`} style={{ ['--ps' as string]: SCALES[fit] }} onClick={(e) => e.stopPropagation()}>
        {notes && <RoughNote level={level} chapter={chapter} n={n} hint={solved ? undefined : latest?.hint} onBack={() => flipTo(false)} />}
        <div className="face-front" style={notes ? { display: 'none' } : undefined} onCopy={copyPlainFractions}>
        {solved && justSolved && <Confetti />}
        <button className="x-close" aria-label="Close" onClick={onClose}>{'✕'}</button>
        <div className="problem-head">
          <span className="coin big"><Medal n={n} kind={solved ? 'green' : 'gold'} /></span>
          <span className="problem-src">{p?.book ? `Book ${p.book}` : ''}{p?.page ? ` · page ${p.page}` : ''}</span>
          {p && !(solved && !justSolved) && (
            <span
              className="lives"
              role="img"
              aria-label={`${Math.min(wrong, 2)} of 2 hearts broken, ${Math.min(hints.length, 3)} of 3 hints used`}
            >
              {[0, 1].map((i) => (
                <span key={`h${i}`} className={`life${bump?.heart && i === wrong - 1 ? ' just' : ''}`}>
                  <Heart broken={i < wrong} />
                </span>
              ))}
              <span className="lives-gap" />
              {[0, 1, 2].map((i) => (
                <span key={`b${i}`} className={`life${bump?.bulb && i === hints.length - 1 ? ' just' : ''}`}>
                  <Bulb lit={i < hints.length} />
                </span>
              ))}
            </span>
          )}
          <button type="button" className="rough-open" onClick={() => flipTo(true)}>📝 Rough note</button>
        </div>
        {!p && !msg && <p className="what">Loading…</p>}
        {!p && msg && <p className="what">{msg}</p>}
        {p && (
          <>
            <div className="problem-prompt"><MathText text={p.prompt} /></div>
            {p.images.map((id) => (
              <img key={id} className="problem-img" src={problemImageUrl(id)} alt="Problem picture" onLoad={() => { setFit(0); setFitEpoch((e) => e + 1); }} />
            ))}
            {solved ? (
              <div className="problem-win">
                {p.puzzle && p.puzzle.type !== 'logicgrid' && (justSolved || review?.solutionCells) && <PuzzleBoard spec={p.puzzle} cells={justSolved ? cells : review?.solutionCells ?? {}} />}
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
                                {h.kind === 'solved' ? '✓ Right' : '✗ Wrong'}: <b><MathText text={fmtAnswers(h.answers, h.cells)} /></b>
                                {h.hint && <em className="given-hint">{h.hintFrom === 'book' ? 'Book hint' : 'Hint'}: “<MathText text={h.hint} />”</em>}
                              </span>
                            </li>
                          ))}
                        </ol>
                        {review.answer && (
                          <>
                            <h4>Answer</h4>
                            <p className="parent-ans"><MathText text={review.answer} /></p>
                          </>
                        )}
                        <RoughThumb level={level} chapter={chapter} n={n} />
                        <h4>Solution</h4>
                        <p className="parent-sol"><MathText text={review.solution} /></p>
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
                {p.puzzle && <PuzzleBoard spec={p.puzzle} cells={cells} onChange={setCells} />}
                {p.parts.map((part, i) => (
                  <div key={part.label} className={`answer-row${wrongParts.has(part.label) ? ' bad' : ''}`}>
                    {(p.parts.length > 1 || p.puzzle?.type === 'logicgrid') && <span className="part-label">{part.label}</span>}
                    {part.choices && part.multi ? (
                      <div className="choices multi" role="group" aria-label={part.label}>
                        {part.choices.map((c) => {
                          const on = (answers[part.label] ?? '').split(', ').includes(c);
                          return (
                            <button key={c} type="button" aria-pressed={on} className={`choice${on ? ' on' : ''}`} onClick={() => {
                              const cur = (answers[part.label] ?? '').split(', ').filter(Boolean);
                              const next = on ? cur.filter((x) => x !== c) : [...cur, c];
                              setAnswers({ ...answers, [part.label]: part.choices!.filter((x) => next.includes(x)).join(', ') });
                            }}>
                              <MathText text={c} />
                            </button>
                          );
                        })}
                      </div>
                    ) : part.choices && asButtons(part.choices) ? (
                      <div className="choices" role="radiogroup" aria-label={part.label}>
                        {part.choices.map((c) => (
                          <button key={c} type="button" role="radio" aria-checked={answers[part.label] === c} className={`choice${answers[part.label] === c ? ' on' : ''}`} onClick={() => setAnswers({ ...answers, [part.label]: c })}>
                            <MathText text={c} />
                          </button>
                        ))}
                      </div>
                    ) : part.choices ? (
                      <ChoicePicker label={part.label} value={answers[part.label] ?? ''} choices={part.choices} onChange={(v) => setAnswers({ ...answers, [part.label]: v })} />
                    ) : p.kind === 'explain' ? (
                      <textarea
                        className="explain"
                        value={answers[part.label] ?? ''}
                        onChange={(e) => setAnswers({ ...answers, [part.label]: e.target.value })}
                        rows={4}
                        placeholder="Write your answer and explain why"
                        aria-label="Your explanation"
                      />
                    ) : isFracPad(part.pad) ? (
                      <span className={`frac-in${padParts.length > 1 && padPart?.label === part.label ? ' pad-active' : ''}`} role="group" aria-label={p.parts.length > 1 ? `Answer ${part.label}` : 'Your answer'}>
                        {fracInput(part.label, 'w', i === 0)}
                        <span className="frac-stack">
                          {fracInput(part.label, 'n')}
                          {fracInput(part.label, 'd')}
                        </span>
                      </span>
                    ) : (
                      <input
                        ref={(el) => {
                          inputs.current[part.label] = el;
                          if (i === 0) first.current = el;
                        }}
                        className={part.pad && padParts.length > 1 && padPart?.label === part.label ? 'pad-active' : undefined}
                        value={answers[part.label] ?? ''}
                        onChange={(e) => setAnswers({ ...answers, [part.label]: e.target.value })}
                        onFocus={() => setActive(part.label)}
                        // number answers use the on-screen pad below, not the iPad keyboard (a real keyboard still types)
                        inputMode={part.pad ? 'none' : 'text'}
                        autoComplete="off"
                        autoCapitalize="off"
                        placeholder="Your answer"
                        aria-label={p.parts.length > 1 ? `Answer ${part.label}` : 'Your answer'}
                      />
                    )}
                  </div>
                ))}
                {padPart && <NumberPad keys={isFracPad(padPart.pad) ? [] : padPart.pad ?? []} onKey={pressKey} />}
                {msg && <div className="problem-msg" role="status">{msg}</div>}
                {latest && (
                  <div className={`hint${latest.hintFrom === 'book' ? ' book' : ''}`}>
                    <Beast className="hint-beast" />
                    <p>{latest.hintFrom === 'book' && <b className="hint-from">📘 Hint from the book</b>}<MathText text={latest.hint} /></p>
                  </div>
                )}
                {hints.length > 1 && (
                  <div className="earlier-hints">
                    <button type="button" className="link" aria-expanded={showEarlier} onClick={() => setShowEarlier((v) => !v)}>
                      {showEarlier ? 'Hide earlier hints' : `Earlier hints (${hints.length - 1})`}
                    </button>
                    {showEarlier && (
                      <ol>
                        {hints.slice(0, -1).reverse().map((h, i) => (
                          <li key={i}>{h.hintFrom === 'book' && <b>📘 </b>}<MathText text={h.hint} /></li>
                        ))}
                      </ol>
                    )}
                  </div>
                )}
                <button className="bn primary" type="submit" disabled={!allFilled || busy}>{busy ? 'Checking…' : 'Check'}</button>
              </form>
            )}
          </>
        )}
        </div>
      </div>
    </div>
  );
}
