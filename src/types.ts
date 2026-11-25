export type TaskType = 'guide' | 'online' | 'practice';
/** Guide reading and online practice are checked off by a parent (passcode); the app can't check that work. */
export const needsParent = (t: TaskType) => t === 'guide' || t === 'online';

export interface Task {
  id: string;
  type: TaskType;
  raw: string;
  text?: string; // online lessons, or anything the importer could not parse
  book?: string;
  pages?: number[];
  topic?: string;
  problems?: { n: number; optional: boolean }[];
}
export interface Box {
  id: string;
  title: string;
  enrichment: boolean;
  extra?: boolean; // problems the official plan skips, added so none are missed
  standards: string[];
  tasks: Task[];
}
export interface Chapter {
  id: string;
  number: number;
  title: string;
  boxes: Box[];
}
export interface Plan {
  level: number;
  chapters: Chapter[];
}
