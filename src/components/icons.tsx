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

const INK = '#1E2A3A';
const MEDAL = {
  gold: ['#FFE08A', '#F2B73D', '#C98A12', '#8E5E0A'],
  green: ['#BDE6A0', '#7DB65E', '#4E8F3A', '#2F6A22'],
  grey: ['#F2F5FA', '#C9D3E3', '#9AA9C0', '#6F7F98'],
} as const;
export type MedalKind = keyof typeof MEDAL;

/** The cartoon problem medal: bevelled rim and edge, glossy face, a white plate with the number. */
export function Medal({ n, kind = 'gold', dashed = false, locked = false }: { n: number; kind?: MedalKind; dashed?: boolean; locked?: boolean }) {
  const [lt, md, dk, edge] = MEDAL[kind];
  const id = `m-${kind}`;
  const digits = String(n).length;
  return (
    <svg className="medal" viewBox="0 0 100 108" aria-hidden="true">
      <defs>
        <linearGradient id={`${id}-rim`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={lt} />
          <stop offset=".5" stopColor={md} />
          <stop offset="1" stopColor={dk} />
        </linearGradient>
        <radialGradient id={`${id}-face`} cx=".35" cy=".28" r=".85">
          <stop offset="0" stopColor={lt} />
          <stop offset=".6" stopColor={md} />
          <stop offset="1" stopColor={dk} />
        </radialGradient>
        <linearGradient id="medal-plate" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#FFFFFF" />
          <stop offset="1" stopColor="#E6ECF4" />
        </linearGradient>
        <linearGradient id="medal-gloss" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#fff" stopOpacity=".95" />
          <stop offset="1" stopColor="#fff" stopOpacity=".1" />
        </linearGradient>
      </defs>
      <ellipse cx="50" cy="104" rx="38" ry="3.4" fill={INK} opacity=".16" />
      <circle cx="50" cy="58" r="46" fill={edge} stroke={INK} strokeWidth="5" />
      <circle cx="50" cy="50" r="46" fill={`url(#${id}-rim)`} stroke={INK} strokeWidth="5" strokeDasharray={dashed ? '11 7' : undefined} />
      <circle cx="50" cy="50" r="38" fill={`url(#${id}-face)`} stroke={dk} strokeWidth="2" />
      <circle cx="50" cy="54" r="31" fill={INK} opacity=".35" />
      <circle cx="50" cy="51" r="31" fill="url(#medal-plate)" stroke={INK} strokeWidth="4" />
      <ellipse cx="33" cy="22" rx="21" ry="7.5" fill="url(#medal-gloss)" transform="rotate(-36 33 22)" />
      <path d="M82 16l2 5 5 2-5 2-2 5-2-5-5-2 5-2z" fill="#fff" />
      <text x="50" y="52" textAnchor="middle" dominantBaseline="central" fontWeight="900" fontSize={digits >= 3 ? 27 : 38} fill={INK} style={{ fontFamily: 'var(--sans)' }}>
        {n}
      </text>
      {locked && (
        <g>
          <circle cx="84" cy="14" r="16" fill="#B5523B" stroke={INK} strokeWidth="4" />
          <path d="M77 14v-3a7 7 0 0 1 14 0v3" fill="none" stroke="#fff" strokeWidth="3.5" strokeLinecap="round" />
          <rect x="75" y="14" width="18" height="13" rx="3.5" fill="#fff" stroke={INK} strokeWidth="2.4" />
          <circle cx="84" cy="20" r="2" fill={INK} />
        </g>
      )}
    </svg>
  );
}

/** One problem. A gold medal is the one to do next, green is solved, grey is locked or optional. */
export function ProblemBadge({ n, optional, delay = 0, state, lockedWhy, onOpen }: { n: number; optional: boolean; delay?: number; state?: 'open' | 'solved' | 'locked'; lockedWhy?: string; onOpen?: () => void }) {
  const kind: MedalKind = state === 'solved' ? 'green' : state === 'locked' || optional ? 'grey' : 'gold';
  const medal = <Medal n={n} kind={kind} dashed={optional} locked={state === 'locked'} />;
  const cls = `coin${optional ? ' optional' : ''}${state ? ` live ${state}` : ''}`;
  const style = { animationDelay: `${delay}ms` };
  if (state === 'locked') {
    return (
      <span className={cls} aria-label={`problem ${n} locked`} data-tip={lockedWhy ? `🔒 ${lockedWhy}` : undefined} style={style}>
        {medal}
      </span>
    );
  }
  const label = `problem ${n}${optional ? ' (optional)' : ''}${state === 'solved' ? ', solved' : ''}`;
  if (state && onOpen) {
    return (
      <button className={cls} aria-label={label} style={style} onClick={onOpen}>
        {medal}
      </button>
    );
  }
  return (
    <span className={cls} aria-label={label} style={style}>
      {medal}
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
  // cartoon star: navy outline, gradient gold, hard shadow and a small shine mark. Unearned = a pale empty slot.
  const d = "M25.00 4.00L31.79 15.66L44.97 18.51L35.98 28.57L37.34 41.99L25.00 36.55L12.66 41.99L14.02 28.57L5.03 18.51L18.21 15.66Z";
  return (
    <svg className={`star${dim ? ' dim' : ''}`} width={size} height={size} viewBox="0 0 50 50" aria-hidden="true" style={{ overflow: 'visible' }}>
      <defs>
        <linearGradient id="starGold" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#FFF6B0" />
          <stop offset=".45" stopColor="#FADA5E" />
          <stop offset="1" stopColor="#F2A81D" />
        </linearGradient>
        <linearGradient id="starEmpty" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#F4F7FA" />
          <stop offset="1" stopColor="#D5DDE6" />
        </linearGradient>
      </defs>
      {dim ? (
        <path d={d} fill="url(#starEmpty)" stroke={INK} strokeOpacity=".3" strokeWidth="3" strokeLinejoin="round" />
      ) : (
        <>
          <path d={d} fill={INK} stroke={INK} strokeWidth="4" strokeLinejoin="round" transform="translate(0 3.4)" />
          <path d={d} fill="url(#starGold)" stroke={INK} strokeWidth="4" strokeLinejoin="round" />
          <ellipse cx="17.5" cy="19.5" rx="4.6" ry="2.2" fill="#fff" opacity=".95" transform="rotate(-40 17.5 19.5)" />
        </>
      )}
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

const HEART = 'M25 44 C 12 35 4 27 4 17 C 4 10 9.5 5 16 5 C 20 5 23 7 25 10.5 C 27 7 30 5 34 5 C 40.5 5 46 10 46 17 C 46 27 38 35 25 44 Z';
/** A cartoon heart (a "life"). `broken`: split down a zigzag crack, the halves tipped apart and faded. */
export function Heart({ broken = false, size = 30 }: { broken?: boolean; size?: number }) {
  return (
    <svg className={`heart${broken ? ' broken' : ''}`} width={size} height={size} viewBox="0 0 50 50" aria-hidden="true" style={{ overflow: 'visible' }}>
      <defs>
        <linearGradient id="heartRed" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#FF8A8A" />
          <stop offset=".5" stopColor="#E5484D" />
          <stop offset="1" stopColor="#B8282E" />
        </linearGradient>
        <linearGradient id="heartGone" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#F3C6C8" />
          <stop offset="1" stopColor="#C98E92" />
        </linearGradient>
        {/* the two halves either side of the crack */}
        <clipPath id="heartL"><path d="M0 0 H27 L22 14 L28 22 L21 31 L26 50 H0 Z" /></clipPath>
        <clipPath id="heartR"><path d="M27 0 H50 V50 H26 L21 31 L28 22 L22 14 Z" /></clipPath>
      </defs>
      {broken ? (
        <>
          <g className="half l" clipPath="url(#heartL)" transform="rotate(-8 18 40) translate(-1 0)">
            <path d={HEART} fill="url(#heartGone)" stroke={INK} strokeOpacity=".55" strokeWidth="3.5" strokeLinejoin="round" />
          </g>
          <g className="half r" clipPath="url(#heartR)" transform="rotate(8 32 40) translate(1 0)">
            <path d={HEART} fill="url(#heartGone)" stroke={INK} strokeOpacity=".55" strokeWidth="3.5" strokeLinejoin="round" />
          </g>
          <path d="M27 6 L22 14 L28 22 L21 31 L26 44" fill="none" stroke={INK} strokeOpacity=".55" strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" />
        </>
      ) : (
        <>
          <path d={HEART} fill={INK} transform="translate(0 3)" />
          <path d={HEART} fill="url(#heartRed)" stroke={INK} strokeWidth="3.5" strokeLinejoin="round" />
          <ellipse cx="14.5" cy="15" rx="5" ry="2.6" fill="#fff" opacity=".9" transform="rotate(-35 14.5 15)" />
        </>
      )}
    </svg>
  );
}

/** A cartoon light bulb (a hint). `lit`: glowing yellow glass with rays; otherwise pale, unused glass. */
export function Bulb({ lit = false, size = 30 }: { lit?: boolean; size?: number }) {
  const glass = 'M25 4 C 15 4 9 11 9 19 C 9 25 12.5 28.5 15.5 32 C 17 34 18 35.5 18 38 H32 C32 35.5 33 34 34.5 32 C 37.5 28.5 41 25 41 19 C 41 11 35 4 25 4 Z';
  return (
    <svg className={`bulb${lit ? ' lit' : ''}`} width={size} height={size} viewBox="0 0 50 50" aria-hidden="true" style={{ overflow: 'visible' }}>
      <defs>
        <radialGradient id="bulbOn" cx=".45" cy=".4" r=".7">
          <stop offset="0" stopColor="#FFFBE0" />
          <stop offset=".5" stopColor="#FFE066" />
          <stop offset="1" stopColor="#F5B31D" />
        </radialGradient>
        <linearGradient id="bulbOff" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#F7F9FB" />
          <stop offset="1" stopColor="#DCE3EA" />
        </linearGradient>
      </defs>
      {lit && (
        <g className="rays" stroke="#F5B31D" strokeWidth="3" strokeLinecap="round">
          <path d="M25 -5 V-1" /><path d="M9 0 L11.5 3" /><path d="M41 0 L38.5 3" />
        </g>
      )}
      <path d={glass} fill={lit ? 'url(#bulbOn)' : 'url(#bulbOff)'} stroke={INK} strokeOpacity={lit ? 1 : 0.4} strokeWidth="3.2" strokeLinejoin="round" />
      {lit && <path d="M20 30 Q 22 22 25 27 Q 28 22 30 30" fill="none" stroke="#E08A00" strokeWidth="2.2" strokeLinecap="round" />}
      {lit && <ellipse cx="18" cy="14" rx="3.6" ry="2" fill="#fff" opacity=".95" transform="rotate(-40 18 14)" />}
      <rect x="17.5" y="38" width="15" height="9" rx="2.5" fill={lit ? '#9AA6B4' : '#C9D1DA'} stroke={INK} strokeOpacity={lit ? 1 : 0.4} strokeWidth="3" />
      <path d="M18.5 42.5 H31.5" stroke={INK} strokeOpacity={lit ? 0.6 : 0.25} strokeWidth="2" />
    </svg>
  );
}
