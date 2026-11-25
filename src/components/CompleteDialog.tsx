import { useEffect, useMemo, useRef } from 'react';
import { play, useWindowSound } from '../sound';
import type { Box } from '../types';
import { Beast, Star } from './icons';

interface Props {
  box?: Box;
  chapterNo: number;
  chapterTitle?: string; // set for a whole-chapter celebration
  emailed: boolean;
  next: { title: string; chapter: number } | null;
  onClose: () => void;
  onNext: () => void;
}

const COLORS = ['#F2B73D', '#2955A5', '#D13B3B', '#3F7F2E', '#F06AA8', '#FFFFFF'];

export function Confetti() {
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

export function CompleteDialog({ box, chapterNo, chapterTitle, emailed, next, onClose, onNext }: Props) {
  const whole = chapterTitle !== undefined;
  // its own fanfare instead of the window pop (played once, even when React re-runs effects in development)
  const played = useRef(false);
  useEffect(() => {
    if (played.current) return;
    played.current = true;
    play(whole ? 'chapter' : 'box');
  }, [whole]);
  useWindowSound(undefined, { open: false });
  return (
    <div className="overlay" onClick={onClose} role="dialog" aria-modal="true" aria-label={whole ? 'Chapter complete' : 'Box complete'}>
      <Confetti />
      <div className="dialog" onClick={(e) => e.stopPropagation()}>
        <Beast className="dlg-beast" />
        <div className="stars" aria-hidden="true"><Star size={58} /><Star size={76} /><Star size={58} /></div>
        <h2>{whole ? 'Chapter complete!' : 'Box complete!'}</h2>
        <p className="what">{whole ? `Chapter ${chapterNo} · ${chapterTitle}` : `${box?.title} · Chapter ${chapterNo}`}</p>
        <p className="mail">{emailed ? 'An email has been sent to let Mom/Dad know.' : whole ? 'Every box in this chapter is checked off.' : 'Great job finishing this box!'}</p>
        {next ? (
          <button className="bn primary" autoFocus onClick={onNext}>{whole ? `Next chapter: ${next.title}` : `Next box: ${next.title}`} ›</button>
        ) : (
          <button className="bn primary" autoFocus onClick={onClose}>All done here!</button>
        )}
        <button className="link" onClick={onClose}>{whole ? 'Stay here' : 'Stay on this box'}</button>
      </div>
    </div>
  );
}
