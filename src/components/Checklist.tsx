import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { LEVELS, PLANS, isBoxDone } from '../plans';
import type { Box } from '../types';
import { Beast } from './icons';
import { TaskRow } from './TaskRow';

/**
 * One box. The right-hand panel must never scroll, so the box measures itself: if its content is
 * taller than the space it was given, it steps down a density level (smaller icons and type) until
 * everything fits, and re-measures when the window is resized.
 */
function BoxView({ box, index, total, complete, done, onToggle, available, solved, onOpenProblem, learn, onOpenLearn, learned, stars, lock }: { box: Box; index: number; total: number; complete: boolean; done: Set<string>; onToggle: (id: string) => void; available: Set<number>; solved: Set<number>; onOpenProblem: (n: number, list: { n: number; optional: boolean }[]) => void; learn: Set<number>; onOpenLearn: (pages: number[], taskId: string) => void; learned: Set<string>; stars: Record<string, number>; lock: Props['lock'] }) {
  const ref = useRef<HTMLElement>(null);
  const [density, setDensity] = useState(0);
  const [epoch, setEpoch] = useState(0);

  useEffect(() => {
    const onResize = () => {
      setDensity(0);
      setEpoch((e) => e + 1);
    };
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  // When the problem data arrives or changes (coins gain stars, locks open), the box's content changes
  // size, so start the fit again from the roomiest density.
  const contentKey = `${available.size}/${solved.size}/${learn.size}/${learned.size}/${Object.keys(lock).length}/${Object.values(stars).join(',')}`;
  const firstKey = useRef(contentKey);
  useEffect(() => {
    if (firstKey.current === contentKey) return;
    firstKey.current = contentKey;
    setDensity(0);
    setEpoch((e) => e + 1);
  }, [contentKey]);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    // task cards clip their own content, so check each card body as well as the box itself
    const over =
      el.scrollHeight > el.clientHeight + 1 ||
      [...el.querySelectorAll<HTMLElement>('.task-body')].some((b) => b.scrollHeight > b.clientHeight + 1);
    if (over && density < 5) setDensity(density + 1);
  }, [density, epoch]);

  return (
    <section ref={ref} className={`box paper d${density}${complete ? ' complete' : ' current'}`}>
      <div className="box-head">
        <span className="box-count">Box {index + 1} of {total}</span>
        <h2>{box.title}</h2>
        {box.enrichment && <span className="tag">Enrichment</span>}
        {box.extra && <span className="tag extra">Extra</span>}
        {complete && <span className="done-flag">✓ Done!</span>}
        {box.standards.length > 0 && <span className="standards">{box.standards.join(', ')}</span>}
      </div>
      <div className="tasks" style={{ ['--cols' as string]: box.tasks.length }}>
        {box.tasks.map((t, i) => (
          <TaskRow key={t.id} task={t} index={i} done={done.has(t.id)} onToggle={() => onToggle(t.id)} available={available} solved={solved} onOpenProblem={onOpenProblem} learn={learn} onOpenLearn={onOpenLearn} learned={learned} stars={stars} lock={lock} />
        ))}
      </div>
    </section>
  );
}

interface Props {
  level: number;
  chapterNo: number;
  boxNo: number | null;
  done: Record<number, Set<string>>;
  onToggle: (box: Box, taskId: string) => void;
  onChapterAll: (chapterNo: number, done: boolean) => void;
  onNavigate: (level: number | null, chapter?: number, box?: number) => void;
  available: Set<number>;
  solved: Set<number>;
  onOpenProblem: (n: number, list: { n: number; optional: boolean }[]) => void;
  learn: Set<number>;
  onOpenLearn: (pages: number[], taskId: string) => void;
  learned: Set<string>;
  stars: Record<string, number>;
  lock: Record<string, { reason: 'learn' } | { reason: 'previous'; need: number } | { reason: 'box'; need: number }>;
}

export function Checklist({ level, chapterNo, boxNo, done, onToggle, onChapterAll, onNavigate, available, solved, onOpenProblem, learn, onOpenLearn, learned, stars, lock }: Props) {
  const plan = PLANS[level];
  const chapter = plan.chapters.find((c) => c.number === chapterNo) ?? plan.chapters[0];
  const d = done[level];
  const doneCount = chapter.boxes.filter((b) => isBoxDone(b, d)).length;

  // Which box is on screen: the one in the URL, else the first unfinished box, else the last one.
  const firstOpen = chapter.boxes.findIndex((b) => !isBoxDone(b, d));
  const idx = boxNo && boxNo >= 1 && boxNo <= chapter.boxes.length ? boxNo - 1 : firstOpen === -1 ? chapter.boxes.length - 1 : firstOpen;
  const box = chapter.boxes[idx];
  const complete = isBoxDone(box, d);

  // NB: braces matter. An effect must return nothing or a cleanup function, and Chrome's scrollTo
  // returns a value, which makes React throw and blanks the whole page.
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, [box.id]);

  // Pin the resolved box into the URL, so finishing a box never silently flips the view to the next
  // one (the celebration dialog's "Next box" button does that on purpose).
  useEffect(() => {
    if (boxNo === null) location.replace(`#/L${level}/c${chapter.number}/b${idx + 1}`);
  }, [boxNo, level, chapter.number, idx]);

  // previous / next box, flowing across chapter boundaries
  const chapters = plan.chapters;
  const ci = chapters.indexOf(chapter);
  const prev = idx > 0 ? { c: chapter.number, b: idx } : ci > 0 ? { c: chapters[ci - 1].number, b: chapters[ci - 1].boxes.length } : null;
  const next = idx < chapter.boxes.length - 1 ? { c: chapter.number, b: idx + 2 } : ci < chapters.length - 1 ? { c: chapters[ci + 1].number, b: 1 } : null;

  const pct = (doneCount / chapter.boxes.length) * 100;
  const allDone = doneCount === chapter.boxes.length;

  return (
    <div className="shell">
      <aside className="sidebar">
        <button className="brand" onClick={() => onNavigate(null)} aria-label="Back to levels">
          <span>Beast</span>
          <span>Academy</span>
        </button>
        <div className="switch" role="tablist">
          {LEVELS.map((l) => (
            <button key={l} role="tab" aria-selected={l === level} className={l === level ? 'active' : ''} onClick={() => onNavigate(l, 1)}>
              Level {l}
            </button>
          ))}
        </div>
        <div className="side-label">CHAPTERS</div>
        <nav>
          {plan.chapters.map((c) => {
            const n = c.boxes.filter((b) => isBoxDone(b, d)).length;
            const full = n === c.boxes.length;
            return (
              <button
                key={c.id}
                className={`chapter${c.number === chapter.number ? ' active' : ''}${full ? ' full' : n > 0 ? ' part' : ''}`}
                style={{ ['--p' as string]: `${(n / c.boxes.length) * 100}%` }}
                data-tip={`${n} of ${c.boxes.length} boxes done`}
                onClick={() => onNavigate(level, c.number)}
              >
                <span className="num">{full ? '✓' : c.number}</span>
                <span className="name">{c.title}</span>
                {n > 0 && <span className="count">{full ? 'Done!' : `${n}/${c.boxes.length}`}</span>}
              </button>
            );
          })}
        </nav>
        <Beast className="side-beast" />
      </aside>

      <main className="main">
        <div className="content">
          <header className="banner">
            <button className="menu-ic" onClick={() => onNavigate(null)} aria-label="Back to levels">☰</button>
            <div className="banner-titles">
              <div className="eyebrow">Level {level} · Chapter {chapter.number}</div>
              <h1>{chapter.title}</h1>
            </div>
            <button className={`all-btn${allDone ? ' undo' : ''}`} onClick={() => onChapterAll(chapter.number, !allDone)}>
              {allDone ? '↺ Undo all' : '✓ Complete whole chapter'}
            </button>
            <div className="xp" role="progressbar" aria-valuemin={0} aria-valuemax={chapter.boxes.length} aria-valuenow={doneCount}>
              <div className="xp-fill" style={{ width: `${pct}%` }} />
              <span key={doneCount}>{doneCount} / {chapter.boxes.length}</span>
            </div>
          </header>

          <div className="strip-row">
            <div className="strip" role="tablist" aria-label="Boxes in this chapter">
              {chapter.boxes.map((b, i) => {
                const isDone = isBoxDone(b, d);
                return (
                  <button
                    key={b.id}
                    role="tab"
                    aria-selected={i === idx}
                    aria-label={`Box ${i + 1}: ${b.title}${isDone ? ' (done)' : ''}`}
                    data-tip={b.title}
                    className={`dot${isDone ? ' done' : ''}${i === idx ? ' on' : ''}`}
                    onClick={() => onNavigate(level, chapter.number, i + 1)}
                  >
                    {isDone ? '✓' : i + 1}
                  </button>
                );
              })}
            </div>
          </div>

          <BoxView key={box.id} box={box} index={idx} total={chapter.boxes.length} complete={complete} done={d} onToggle={(id) => onToggle(box, id)} available={available} solved={solved} onOpenProblem={onOpenProblem} learn={learn} onOpenLearn={onOpenLearn} learned={learned} stars={stars} lock={lock} />
        </div>

        <div className="track">
          <button className="bn" disabled={!prev} onClick={() => prev && onNavigate(level, prev.c, prev.b)}>‹ Back</button>
          <button className={`bn next${complete ? ' go' : ''}`} disabled={!next} onClick={() => next && onNavigate(level, next.c, next.b)}>
            Next box ›
          </button>
        </div>
      </main>
    </div>
  );
}
