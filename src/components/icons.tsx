import type { TaskType } from '../types';

/** Sheet-with-folded-corner icon showing one page number (matches the approved design). */
export function PageIcon({ n, kind, delay = 0 }: { n: number; kind: TaskType; delay?: number }) {
  const w = n > 99 ? 46 : 38;
  const h = 46;
  return (
    <span className={`page-icon ${kind}`} role="img" aria-label={`page ${n}`} style={{ animationDelay: `${delay}ms` }}>
      <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} aria-hidden="true">
        <path
          className="sheet"
          d={`M1 6 Q1 1 6 1 L${w - 14} 1 L${w - 1} 14 L${w - 1} ${h - 6} Q${w - 1} ${h - 1} ${w - 6} ${h - 1} L6 ${h - 1} Q1 ${h - 1} 1 ${h - 6} Z`}
        />
        <path className="fold" d={`M${w - 14} 1 L${w - 14} 9 Q${w - 14} 14 ${w - 9} 14 L${w - 1} 14 Z`} />
        <text x={w / 2} y={h - 10} textAnchor="middle">
          {n}
        </text>
      </svg>
    </span>
  );
}

/** Round numbered badge for one problem; dashed outline = optional. */
export function ProblemBadge({ n, optional, delay = 0 }: { n: number; optional: boolean; delay?: number }) {
  return (
    <span className={`problem${optional ? ' optional' : ''}`} aria-label={`problem ${n}${optional ? ' (optional)' : ''}`} style={{ animationDelay: `${delay}ms` }}>
      {n}
    </span>
  );
}

export function StepGuide() {
  return (
    <div className="steps" aria-label="Each box goes Guide, then Online, then Practice">
      <span className="step guide"><b>1</b>Guide</span>
      <i>›</i>
      <span className="step online"><b>2</b>Online</span>
      <i>›</i>
      <span className="step practice"><b>3</b>Practice</span>
    </div>
  );
}
