import level4 from '../../src/data/level4.json';
import level5 from '../../src/data/level5.json';

export interface PlanTask {
  id: string;
  type: 'guide' | 'online' | 'practice';
  pages?: number[];
  problems?: { n: number; optional: boolean }[];
}
export interface PlanBox {
  id: string;
  title: string;
  tasks: PlanTask[];
}
export interface PlanChapter {
  number: number;
  title: string;
  boxes: PlanBox[];
}
export interface Plan {
  level: number;
  chapters: PlanChapter[];
}

const plans: Record<string, Plan> = { '4': level4 as Plan, '5': level5 as Plan };

export function getPlan(level: string): Plan | null {
  return plans[level] ?? null;
}

/** Finds the chapter + box that own a task id (task ids are `${boxId}-${type}`). */
export function findTask(plan: Plan, taskId: string) {
  for (const chapter of plan.chapters) {
    for (const box of chapter.boxes) {
      if (box.tasks.some((t) => t.id === taskId)) return { chapter, box };
    }
  }
  return null;
}
