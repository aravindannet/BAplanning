import { LEVELS, PLANS, isBoxDone } from '../plans';

export function LevelPicker({ done, onPick }: { done: Record<number, Set<string>>; onPick: (level: number) => void }) {
  return (
    <main className="picker">
      <h1>Beast Academy</h1>
      <p className="sub">Pick your level to open your to-do list</p>
      <div className="level-cards">
        {LEVELS.map((l) => {
          const plan = PLANS[l];
          const boxes = plan.chapters.flatMap((c) => c.boxes);
          const complete = boxes.filter((b) => isBoxDone(b, done[l])).length;
          const pct = boxes.length ? (complete / boxes.length) * 100 : 0;
          return (
            <button key={l} className="level-card" onClick={() => onPick(l)}>
              <h2>Level {l}</h2>
              <p>
                {plan.chapters.length} chapters · {plan.chapters[0].title} to {plan.chapters[plan.chapters.length - 1].title}
              </p>
              <div className="bar"><div style={{ width: `${pct}%` }} /></div>
              <strong>
                {complete === 0 ? 'Not started' : `${complete} of ${boxes.length} boxes done`}
              </strong>
            </button>
          );
        })}
      </div>
    </main>
  );
}
