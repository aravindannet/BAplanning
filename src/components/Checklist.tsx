import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { LEVELS, PLANS, isBoxDone } from '../plans';
import type { Box } from '../types';
import { StepGuide } from './icons';
import { TaskRow } from './TaskRow';

/**
 * One box. The right-hand panel must never scroll, so the box measures itself: if its content is
 * taller than the space it was given, it steps down a density level (smaller icons and type) until
 * everything fits, and re-measures when the window is resized.
 */
function BoxView({ box, index, total, complete, done, onToggle }: { box: Box; index: number; total: number; complete: boolean; done: Set<string>; onToggle: (id: string) => void }) {
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

  useLayoutEffect(() => {
    const el = ref.current;
    if (el && el.scrollHeight > el.clientHeight + 1 && density < 5) setDensity(density + 1);
  }, [density, epoch]);

  return (
    <section ref={ref} className={`box d${density}${complete ? ' complete' : ' current'}`}>
      <div className="box-head">
        <span className="box-count">Box {index + 1} of {total}</span>
        <h2>{box.title}</h2>
        {box.enrichment && <span className="tag">Enrichment</span>}
        {box.extra && <span className="tag extra">Extra</span>}
        {complete && <span className="done-flag">✓ Done!</span>}
        {box.standards.length > 0 && <span className="standards">{box.standards.join(', ')}</span>}      </div>
      <div className="tasks" style={{ ['--cols' as string]: box.tasks.length }}>
        {box.tasks.map((t, i) => (
          <TaskRow key={t.id} task={t} index={i} done={done.has(t.id)} onToggle={() => onToggle(t.id)} />
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
  onNavigate: (level: number | null, chapter?: number, box?: number) => void;
}

export function Checklist({ level, chapterNo, boxNo, done, onToggle, onNavigate }: Props) {
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

  return (
    <div className="shell">
      <aside className="sidebar">
        <button className="brand" onClick={() => onNavigate(null)}>Beast Academy</button>
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
            return (
              <button key={c.id} className={c.number === chapter.number ? 'chapter active' : 'chapter'} onClick={() => onNavigate(level, c.number)}>
                <span className="num">{c.number}</span>
                <span className="name">{c.title}</span>
                {n > 0 && <span className="count">{n}/{c.boxes.length}</span>}
              </button>
            );
          })}
        </nav>
      </aside>

      <main className="main">
        <header>
          <div className="eyebrow">CHAPTER {chapter.number}</div>
          <h1>{chapter.title}</h1>
          <div className="bar"><div style={{ width: `${(doneCount / chapter.boxes.length) * 100}%` }} /></div>
          <div className="stats">
            <span className="badge"><b key={doneCount}>{doneCount}</b> of {chapter.boxes.length} boxes done</span>
            <StepGuide />
          </div>
        </header>

        <div className="strip" role="tablist" aria-label="Boxes in this chapter">
          {chapter.boxes.map((b, i) => {
            const isDone = isBoxDone(b, d);
            return (
              <button
                key={b.id}
                role="tab"
                aria-selected={i === idx}
                aria-label={`Box ${i + 1}: ${b.title}${isDone ? ' (done)' : ''}`}
                title={b.title}
                className={`dot${isDone ? ' done' : ''}${i === idx ? ' on' : ''}`}
                onClick={() => onNavigate(level, chapter.number, i + 1)}
              >
                {isDone ? '✓' : i + 1}
              </button>
            );
          })}
        </div>

        <div className="stage">
          <BoxView key={box.id} box={box} index={idx} total={chapter.boxes.length} complete={complete} done={d} onToggle={(id) => onToggle(box, id)} />

          <div className="pager">
            <button disabled={!prev} onClick={() => prev && onNavigate(level, prev.c, prev.b)}>‹ Back</button>
            <button className={complete ? 'go' : ''} disabled={!next} onClick={() => next && onNavigate(level, next.c, next.b)}>
              Next box ›
            </button>
          </div>
        </div>
      </main>
    </div>
  );
}
