import { LEVELS, PLANS, isBoxDone } from '../plans';
import { Beast } from './icons';

export function LevelPicker({ done, onPick }: { done: Record<number, Set<string>>; onPick: (level: number) => void }) {
  return (
    <main className="picker">
      <div className="picker-body">
        <h1 className="sign">BEAST ACADEMY</h1>
        <p className="sub">Pick your level to open your to-do list</p>
        <div className="level-cards">
          {LEVELS.map((l) => {
            const plan = PLANS[l];
            const boxes = plan.chapters.flatMap((c) => c.boxes);
            const complete = boxes.filter((b) => isBoxDone(b, done[l])).length;
            const pct = boxes.length ? (complete / boxes.length) * 100 : 0;
            return (
              <button key={l} className={`level-card lv${l}`} onClick={() => onPick(l)}>
                <div className="lc-banner">
                  <span className="lc-num">{l}</span>
                  <span className="lc-title">LEVEL {l}</span>
                </div>
                <div className="lc-body">
                  <p>
                    {plan.chapters.length} chapters · {plan.chapters[0].title} to {plan.chapters[plan.chapters.length - 1].title}
                  </p>
                  <div className="xp" aria-hidden="true">
                    <div className="xp-fill" style={{ width: `${pct}%` }} />
                  </div>
                  <strong>{complete === 0 ? 'Not started yet' : `${complete} of ${boxes.length} boxes done`}</strong>
                  <span className="bn open">Open ›</span>
                </div>
              </button>
            );
          })}
        </div>
      </div>
      <div className="ground">
        <Beast className="ground-beast" />
      </div>
    </main>
  );
}
