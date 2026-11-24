import type { Task } from '../types';
import { PageIcon, ProblemBadge } from './icons';

const LABEL = { guide: 'Read the Guide', online: 'Online practice', practice: 'Book practice' } as const;

/**
 * One task card. Two controls toggle it: the small round checkbox next to the title and the big
 * "Mark as done" button at the bottom. Everything else on the card is information only.
 */
export function TaskRow({ task, index, done, onToggle, available, solved, onOpenProblem }: { task: Task; index: number; done: boolean; onToggle: () => void; available?: Set<number>; solved?: Set<number>; onOpenProblem?: (n: number, list: number[]) => void }) {
  // A practice task can't be ticked until every required problem that is in the app is solved.
  // Dashed (optional) problems are never required, and problems without a scan can't block.
  const pending = !done && task.type === 'practice' ? (task.problems ?? []).filter((p) => !p.optional && available?.has(p.n) && !solved?.has(p.n)).length : 0;
  const locked = pending > 0;
  const hasOptional = task.problems?.some((p) => p.optional);
  return (
    <div className={`task ${task.type}${done ? ' done' : ''}`}>
      <div className="task-banner">
        <span className="task-num">{index + 1}</span>
        <span className="task-label">{LABEL[task.type]}</span>
      </div>
      <div className="task-body">
        <div className="task-head">
          <button className="check" role="checkbox" aria-checked={done} aria-label={LABEL[task.type]} disabled={locked} title={locked ? `Solve ${pending} more problem${pending > 1 ? 's' : ''} first` : undefined} onClick={onToggle}>
            {done && <span aria-hidden="true">✓</span>}
          </button>
          <div className="task-main">
            {task.pages
              ? `${task.book ? `Book ${task.book} · ` : ''}${task.pages.length > 1 ? 'pages' : 'page'}`
              : (task.text ?? task.raw)}
          </div>
        </div>
        {task.pages && (
          <div className="icons">
            {task.pages.map((p, i) => (
              <PageIcon key={p} n={p} kind={task.type} delay={i * 45} />
            ))}
          </div>
        )}
        {task.topic && <div className="topic">Topic: {task.topic}</div>}
        {task.problems && task.problems.length > 0 && (
          <>
            <div className="problems-label">Problems{hasOptional ? ' · dashed = optional' : ''}{task.problems.some((p) => available?.has(p.n)) ? ' · tap a number to solve it here' : ''}</div>
            <div className="icons">
              {task.problems.map((p, i) => (
                <ProblemBadge key={p.n} n={p.n} optional={p.optional} delay={i * 25} state={available?.has(p.n) ? (solved?.has(p.n) ? 'solved' : 'open') : undefined} onOpen={onOpenProblem ? () => onOpenProblem(p.n, task.problems!.map((x) => x.n)) : undefined} />
              ))}
            </div>
          </>
        )}
        <button className={`mark${locked ? ' locked' : ''}`} aria-pressed={done} disabled={locked} onClick={onToggle}>
          {done ? '✓  Done!' : locked ? `🔒  Solve ${pending} more to finish` : '☐  Mark as done'}
        </button>
      </div>
    </div>
  );
}
