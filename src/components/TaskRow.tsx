import { needsParent, type Task } from '../types';
import { PageIcon, ProblemBadge, Stars } from './icons';

const LABEL = { guide: 'Read the Guide', online: 'Online practice', practice: 'Book practice' } as const;

/**
 * One task card. Two controls toggle it: the small round checkbox next to the title and the big
 * "Mark as done" button at the bottom. Everything else on the card is information only.
 */
function lockWhy(l?: { reason: 'learn' } | { reason: 'previous'; need: number } | { reason: 'box'; need: number }): string | undefined {
  if (!l) return undefined;
  if (l.reason === 'learn') return 'Read Learn first';
  if (l.reason === 'box') return `Finish problem ${l.need} in the earlier box first`;
  return `Solve problem ${l.need} first`;
}

export function TaskRow({ task, index, done, onToggle, available, solved, onOpenProblem, learn, onOpenLearn, learned, stars, lock }: { task: Task; index: number; done: boolean; onToggle: () => void; available?: Set<number>; solved?: Set<number>; onOpenProblem?: (n: number, list: { n: number; optional: boolean }[]) => void; learn?: Set<number>; onOpenLearn?: (pages: number[], taskId: string) => void; learned?: Set<string>; stars?: Record<string, number>; lock?: Record<string, { reason: 'learn' } | { reason: 'previous'; need: number } | { reason: 'box'; need: number }> }) {
  // A practice task can't be ticked until every required problem that is in the app is solved.
  // Dashed (optional) problems are never required, and problems without a scan can't block.
  const pending = !done && task.type === 'practice' ? (task.problems ?? []).filter((p) => !p.optional && available?.has(p.n) && !solved?.has(p.n)).length : 0;
  const locked = pending > 0;
  const tipText = locked ? `🔒 Solve ${pending} more problem${pending > 1 ? 's' : ''} first` : undefined;
  const learnPages = task.type === 'practice' && learn ? (task.pages ?? []).filter((p) => learn.has(p)) : [];
  const learnLock = lock?.[`learn:${task.id}`];
  const learnPending = learnPages.length > 0 && !learned?.has(task.id);
  const hasOptional = task.problems?.some((p) => p.optional);
  const parent = needsParent(task.type); // a grown-up checks this one off with the passcode
  return (
    <div className={`task ${task.type}${done ? ' done' : ''}`}>
      <div className="task-banner">
        <span className="task-num">{index + 1}</span>
        <span className="task-label">{LABEL[task.type]}</span>
          {learnPages.length > 0 && onOpenLearn && (learnLock ? (
            <span className="tip-wrap learn-wrap" data-tip={`🔒 ${lockWhy(learnLock)}`}>
              <button className="learn-btn locked" disabled>🔒 Learn</button>
            </span>
          ) : (
            <button className={`learn-btn${learnPending ? ' pending' : ''}`} onClick={() => onOpenLearn(learnPages, task.id)}>{learnPending ? '📖 Learn first!' : '📖 Learn'}</button>
          ))}
      </div>
      <div className="task-body">
        <div className="task-head">
          <span className="tip-wrap" data-tip={tipText}><button className="check" role="checkbox" aria-checked={done} aria-label={LABEL[task.type]} disabled={locked} onClick={onToggle}>
            {done && <span aria-hidden="true">✓</span>}
          </button></span>
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
            <div className="problems-label">Problems{hasOptional ? ' · dashed = optional' : ''}{task.problems.some((p) => available?.has(p.n)) ? ' · solve them in order' : ''}</div>
            <div className="icons">
              {task.problems.map((p, i) => (
                <span key={p.n} className={available?.has(p.n) ? 'coin-wrap' : 'coin-plain'}>
                <ProblemBadge
                  n={p.n}
                  optional={p.optional}
                  delay={i * 25}
                  state={!available?.has(p.n) ? undefined : solved?.has(p.n) ? 'solved' : lock?.[p.n] ? 'locked' : 'open'}
                  lockedWhy={lockWhy(lock?.[p.n])}
                  onOpen={onOpenProblem ? () => onOpenProblem(p.n, task.problems!.filter((x) => available?.has(x.n)).map((x) => ({ n: x.n, optional: x.optional }))) : undefined}
                />
                {available?.has(p.n) && <Stars arc earned={solved?.has(p.n) ? stars?.[p.n] ?? 3 : 0} />}
                </span>
              ))}
            </div>
          </>
        )}
        <span className="tip-wrap block" data-tip={tipText}><button className={`mark${locked ? ' locked' : ''}`} aria-pressed={done} disabled={locked} onClick={onToggle}>
          {done ? (parent ? '✓  Checked by a grown-up' : '✓  Done!') : locked ? `🔒  Solve ${pending} more` : parent ? '👀  Show a grown-up' : '☐  Mark as done'}
        </button></span>
      </div>
    </div>
  );
}
