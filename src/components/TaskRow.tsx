import type { Task } from '../types';
import { PageIcon, ProblemBadge } from './icons';

const LABEL = { guide: 'Read the Guide', online: 'Online practice', practice: 'Book practice' } as const;

/**
 * One task card. Two controls toggle it: the small round checkbox next to the title and the big
 * "Mark as done" button at the bottom. Everything else on the card is information only.
 */
export function TaskRow({ task, index, done, onToggle }: { task: Task; index: number; done: boolean; onToggle: () => void }) {
  const hasOptional = task.problems?.some((p) => p.optional);
  return (
    <div className={`task ${task.type}${done ? ' done' : ''}`}>
      <div className="task-banner">
        <span className="task-num">{index + 1}</span>
        <span className="task-label">{LABEL[task.type]}</span>
      </div>
      <div className="task-body">
        <div className="task-head">
          <button className="check" role="checkbox" aria-checked={done} aria-label={LABEL[task.type]} onClick={onToggle}>
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
            <div className="problems-label">Problems{hasOptional ? ' · dashed = optional' : ''}</div>
            <div className="icons">
              {task.problems.map((p, i) => (
                <ProblemBadge key={p.n} n={p.n} optional={p.optional} delay={i * 25} />
              ))}
            </div>
          </>
        )}
        <button className="mark" aria-pressed={done} onClick={onToggle}>
          {done ? '✓  Done!' : '☐  Mark as done'}
        </button>
      </div>
    </div>
  );
}
