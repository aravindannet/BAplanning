// Practice-order rules (enforced on the server):
//  0. A practice task opens only after every REQUIRED problem of the earlier practice boxes is solved.
//  1. If a practice task has a Learn page, Learn must be finished before any of its problems open.
//  2. Problems open one by one in book order: a problem opens once every earlier REQUIRED (non-dashed)
//     problem is solved. Optional (dashed) problems never block anything.
//  3. Problems with no scan can't be solved in the app, so they neither lock nor block.
import type { PlanChapter, PlanTask } from './_plan';

export type LockReason = { reason: 'learn' } | { reason: 'previous'; need: number } | { reason: 'box'; need: number };

export interface GateInput {
  available: Set<number>; // problems that exist in the app
  solved: Set<number>;
  learnPages: Set<number>; // book pages that have a Learn image
  learned: boolean; // this task's Learn was finished
  blockedBy?: number | null; // first required unsolved problem in an EARLIER box (locks this whole task)
}

export function taskNeedsLearn(task: PlanTask, learnPages: Set<number>): boolean {
  return (task.pages ?? []).some((p) => learnPages.has(p));
}

/** Which of the task's problems are locked, and why. Problems not listed are open. */
export function gateTask(task: PlanTask, g: GateInput): Map<number, LockReason> {
  const locked = new Map<number, LockReason>();
  const learnNeeded = taskNeedsLearn(task, g.learnPages) && !g.learned;
  let need: number | null = null;
  for (const p of task.problems ?? []) {
    if (!g.available.has(p.n)) continue;
    if (!g.solved.has(p.n)) {
      if (g.blockedBy != null) locked.set(p.n, { reason: 'box', need: g.blockedBy });
      else if (learnNeeded) locked.set(p.n, { reason: 'learn' });
      else if (need !== null) locked.set(p.n, { reason: 'previous', need });
    }
    if (!p.optional && !g.solved.has(p.n) && need === null) need = p.n;
  }
  return locked;
}

/** First required (non-dashed) problem of the task that exists in the app and is not solved yet. */
export function firstRequiredUnsolved(task: PlanTask, available: Set<number>, solved: Set<number>): number | null {
  return (task.problems ?? []).find((p) => !p.optional && available.has(p.n) && !solved.has(p.n))?.n ?? null;
}

export function practiceTasks(chapter: PlanChapter): PlanTask[] {
  return chapter.boxes.flatMap((b) => b.tasks).filter((t) => t.type === 'practice' && (t.problems?.length ?? 0) > 0);
}

export function taskForProblem(chapter: PlanChapter, n: number): PlanTask | null {
  return practiceTasks(chapter).find((t) => t.problems!.some((p) => p.n === n)) ?? null;
}

/** Stars for a solved problem from the wrong answers before it: 0-1 wrong = 3, 2 wrong (a hint was shown) = 2, 3+ wrong = 1. */
export function starsFor(wrongBefore: number): number {
  return wrongBefore <= 1 ? 3 : wrongBefore === 2 ? 2 : 1;
}
