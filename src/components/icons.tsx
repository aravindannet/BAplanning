import type { TaskType } from '../types';

/** Sheet-with-folded-corner icon showing one page number. */
export function PageIcon({ n, kind, delay = 0 }: { n: number; kind: TaskType; delay?: number }) {
  const w = n > 99 ? 52 : 46;
  const h = 58;
  return (
    <span className={`page-icon ${kind}`} role="img" aria-label={`page ${n}`} style={{ animationDelay: `${delay}ms` }}>
      <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} aria-hidden="true">
        <path
          className="sheet"
          d={`M1.5 8 Q1.5 1.5 8 1.5 L${w - 17} 1.5 L${w - 1.5} 17 L${w - 1.5} ${h - 8} Q${w - 1.5} ${h - 1.5} ${w - 8} ${h - 1.5} L8 ${h - 1.5} Q1.5 ${h - 1.5} 1.5 ${h - 8} Z`}
        />
        <path className="fold" d={`M${w - 17} 1.5 L${w - 17} 11 Q${w - 17} 17 ${w - 11} 17 L${w - 1.5} 17 Z`} />
        <text x={w / 2} y={h - 12} textAnchor="middle">
          {n}
        </text>
      </svg>
    </span>
  );
}

/** Gold coin for one problem; a dashed pale coin means optional. Clickable when the question is in the app. */
export function ProblemBadge({ n, optional, delay = 0, state, lockedWhy, onOpen }: { n: number; optional: boolean; delay?: number; state?: 'open' | 'solved' | 'locked'; lockedWhy?: string; onOpen?: () => void }) {
  const cls = `coin${optional ? ' optional' : ''}${state ? ` live ${state}` : ''}`;
  if (state === 'locked') {
    return (
      <span className={`coin${optional ? ' optional' : ''} live locked`} aria-label={`problem ${n} locked`} title={lockedWhy} style={{ animationDelay: `${delay}ms` }}>
        {n}
      </span>
    );
  }
  const label = `problem ${n}${optional ? ' (optional)' : ''}${state === 'solved' ? ', solved' : ''}`;
  if (state && onOpen) {
    return (
      <button className={cls} aria-label={label} style={{ animationDelay: `${delay}ms` }} onClick={onOpen}>
        {state === 'solved' ? '\u2713' : n}
      </button>
    );
  }
  return (
    <span className={cls} aria-label={label} style={{ animationDelay: `${delay}ms` }}>
      {n}
    </span>
  );
}

/** The friendly pink beast (an original character, not Beast Academy artwork). */
export function Beast({ className = '' }: { className?: string }) {
  const ink = '#1E2A3A';
  return (
    <svg className={`beast ${className}`} viewBox="0 -44 120 176" aria-hidden="true">
      <path d="M30 26 Q34 2 46 -14" fill="none" stroke={ink} strokeWidth="4" strokeLinecap="round" />
      <path d="M94 26 Q90 2 78 -14" fill="none" stroke={ink} strokeWidth="4" strokeLinecap="round" />
      <circle cx="23" cy="-19" r="11" fill="#F7C948" stroke={ink} strokeWidth="3" />
      <circle cx="97" cy="-19" r="11" fill="#F7C948" stroke={ink} strokeWidth="3" />
      <ellipse cx="60" cy="74" rx="52" ry="54" fill="#F06AA8" stroke={ink} strokeWidth="4" />
      <ellipse cx="60" cy="96" rx="32" ry="26" fill="#FBD3E6" stroke={ink} strokeWidth="3" />
      <ellipse cx="40" cy="57" rx="16" ry="19" fill="#fff" stroke={ink} strokeWidth="3" />
      <ellipse cx="80" cy="57" rx="16" ry="19" fill="#fff" stroke={ink} strokeWidth="3" />
      <ellipse cx="41" cy="61" rx="7" ry="9" fill={ink} />
      <ellipse cx="79" cy="61" rx="7" ry="9" fill={ink} />
      <circle cx="40.5" cy="58" r="2.5" fill="#fff" />
      <circle cx="78.5" cy="58" r="2.5" fill="#fff" />
      <path d="M46 86 Q60 102 74 86" fill="none" stroke={ink} strokeWidth="4" strokeLinecap="round" />
      <ellipse cx="24" cy="83" rx="8" ry="4.5" fill="#FF8FB8" />
      <ellipse cx="96" cy="83" rx="8" ry="4.5" fill="#FF8FB8" />
    </svg>
  );
}

export function Star({ size = 56, dim = false }: { size?: number; dim?: boolean }) {
  // a chunky, rounded, cartoon star: fat outline, soft highlight, little shine
  return (
    <svg className={`star${dim ? ' dim' : ''}`} width={size} height={size} viewBox="0 0 50 50" aria-hidden="true" style={{ overflow: 'visible' }}>
      <path
        d="M25 4 L31.5 18.5 L47 20 L35.5 30.5 L39 46 L25 38 L11 46 L14.5 30.5 L3 20 L18.5 18.5 Z"
        fill={dim ? '#E7EBF1' : '#FFC93C'}
        stroke={dim ? '#B7C0CD' : '#A85F00'}
        strokeWidth="5.5"
        strokeLinejoin="round"
      />
      {!dim && <path d="M25 11 L28 19 L36 20 L30 25.5" fill="none" stroke="#FFF1B8" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" opacity=".9" />}
      {!dim && <ellipse cx="17.5" cy="22.5" rx="2.4" ry="1.5" fill="#fff" opacity=".85" transform="rotate(-30 17.5 22.5)" />}
    </svg>
  );
}

/** Three small stars; `earned` of them are gold. With `arc` they curve around the bottom of a problem coin. */
export function Stars({ earned, size = 13, arc = false }: { earned: number; size?: number; arc?: boolean }) {
  return (
    <span className={`coin-stars${arc ? ' arc' : ''}`} role="img" aria-label={`${earned} of 3 stars`}>
      {[0, 1, 2].map((i) => (
        <span key={i} className={`cs${i < earned ? ' pop' : ''}`} style={{ animationDelay: `${i * 120}ms` }}>
          <Star size={size} dim={i >= earned} />
        </span>
      ))}
    </span>
  );
}
