import { useMemo } from 'react';
import type { Box } from '../types';

interface Props {
  box: Box;
  chapterNo: number;
  emailed: boolean;
  next: { title: string; chapter: number } | null;
  onClose: () => void;
  onNext: () => void;
}

const COLORS = ['#f58220', '#2f7de1', '#2e9e6b', '#e8478b', '#f6c90e', '#8a5cd6'];

function Confetti() {
  // Pure-CSS confetti: random but stable per mount.
  const pieces = useMemo(
    () =>
      Array.from({ length: 56 }, (_, i) => ({
        left: Math.random() * 100,
        delay: Math.random() * 0.5,
        dur: 1.8 + Math.random() * 1.6,
        drift: (Math.random() - 0.5) * 220,
        spin: 360 + Math.random() * 720,
        color: COLORS[i % COLORS.length],
        round: i % 3 === 0,
      })),
    [],
  );
  return (
    <div className="confetti" aria-hidden="true">
      {pieces.map((p, i) => (
        <i
          key={i}
          style={{
            left: `${p.left}%`,
            background: p.color,
            borderRadius: p.round ? '50%' : '2px',
            animationDelay: `${p.delay}s`,
            animationDuration: `${p.dur}s`,
            ['--drift' as string]: `${p.drift}px`,
            ['--spin' as string]: `${p.spin}deg`,
          }}
        />
      ))}
    </div>
  );
}

export function CompleteDialog({ box, chapterNo, emailed, next, onClose, onNext }: Props) {
  return (
    <div className="overlay" onClick={onClose} role="dialog" aria-modal="true" aria-label="Box complete">
      <Confetti />
      <div className="dialog" onClick={(e) => e.stopPropagation()}>
        <div className="party" aria-hidden="true">🎉</div>
        <h2>Box complete!</h2>
        <p className="what">{box.title} · Chapter {chapterNo}</p>
        <div className="stars" aria-hidden="true"><span>⭐</span><span>⭐</span><span>⭐</span></div>
        <p className="mail">{emailed ? 'An email has been sent to let Mom/Dad know.' : 'Great job finishing this box!'}</p>
        {next ? (
          <button className="primary" autoFocus onClick={onNext}>Next box: {next.title} ›</button>
        ) : (
          <button className="primary" autoFocus onClick={onClose}>All done here!</button>
        )}
        <button className="link" onClick={onClose}>Stay on this box</button>
      </div>
    </div>
  );
}
