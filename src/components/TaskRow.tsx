import type { Task } from '../types';
import { PageIcon, ProblemBadge } from './icons';

const LABEL = { guide: 'Read the Guide', online: 'Online practice', practice: 'Book practice' } as const;

export function TaskRow({ task, index, done, onToggle }: { task: Task; index: number; done: boolean; onToggle: () => void }) {
  const hasOptional = task.problems?.some((p) => p.optional);
  return (
    <div className={`task ${task.type}${done ? ' done' : ''}`}>
      <div className="task-head">
        {/* Only the checkbox toggles a task; the rest of the card is just information. */}
        <button className="check" role="checkbox" aria-checked={done} aria-label={LABEL[task.type]} onClick={onToggle}>
          {done && <span aria-hidden="true">✓</span>}
        </button>
        <div className="task-titles">
          <div className="task-label">
            {index + 1}&nbsp;&nbsp;{LABEL[task.type]}
          </div>
          <div className="task-main">
            {task.pages
              ? `${task.book ? `Book ${task.book} · ` : ''}${task.pages.length > 1 ? 'pages' : 'page'}`
              : (task.text ?? task.raw)}
          </div>
        </div>
      </div>
      {(task.pages || task.topic || (task.problems && task.problems.length > 0)) && (
        <div className="task-details">
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
        </div>
      )}
    </div>
  );
}
