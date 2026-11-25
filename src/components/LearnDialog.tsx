import { useEffect, useState } from 'react';
import { learnImageUrl, markLearned } from '../api';

/** The book's explanation / example area for the pages of a practice task, shown as scanned. */
export function LearnDialog({ level, chapter, pages, taskId, alreadyLearned, onLearned, onClose }: { level: number; chapter: number; pages: number[]; taskId: string; alreadyLearned: boolean; onLearned: () => void; onClose: () => void }) {
  const [i, setI] = useState(0);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);
  const page = pages[i];
  const last = i === pages.length - 1;
  const finish = async () => {
    if (!alreadyLearned) {
      try {
        await markLearned(level, chapter, taskId);
        onLearned();
      } catch {
        /* the kid can try again */
      }
    }
    onClose();
  };
  return (
    <div className="overlay" onClick={onClose} role="dialog" aria-modal="true" aria-label="Learn">
      <div className="dialog learn" onClick={(e) => e.stopPropagation()}>
        <button className="x-close" aria-label="Close" onClick={onClose}>{'✕'}</button>
        <div className="problem-head">
          <span className="learn-title">📖 Learn</span>
          <span className="problem-src">Book page {page}</span>
        </div>
        <div className="learn-scroll">
          <img key={page} className="learn-img" src={learnImageUrl(level, chapter, page)} alt={`Lesson on page ${page}`} />
        </div>
        <div className="learn-nav">
          {pages.length > 1 && (
            <>
              <button className="bn" disabled={i === 0} onClick={() => setI(i - 1)}>{'‹'} Prev</button>
              <span className="problem-src">{i + 1} of {pages.length}</span>
              <button className="bn" disabled={i === pages.length - 1} onClick={() => setI(i + 1)}>Next {'›'}</button>
            </>
          )}
          <button className="bn primary" disabled={!last} onClick={() => void finish()}>{last ? (alreadyLearned ? 'Close' : 'Got it!') : 'Read all pages'}</button>
        </div>
      </div>
    </div>
  );
}
