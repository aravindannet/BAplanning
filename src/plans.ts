import level4 from './data/level4.json';
import level5 from './data/level5.json';
import type { Box, Plan } from './types';

export const PLANS: Record<number, Plan> = { 4: level4 as Plan, 5: level5 as Plan };
export const LEVELS = [4, 5] as const;

export const isBoxDone = (box: Box, done: Set<string>) => box.tasks.every((t) => done.has(t.id));
