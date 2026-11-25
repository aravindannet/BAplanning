import type { Cells, PuzzleSpec } from '../netlify/functions/_puzzle';
const PIN_KEY = 'ba.pin';

export const getPin = () => {
  try {
    return localStorage.getItem(PIN_KEY) ?? '';
  } catch {
    return '';
  }
};
export const setPin = (pin: string) => {
  try {
    localStorage.setItem(PIN_KEY, pin);
  } catch {
    /* private mode: PIN just won't persist */
  }
};

export class PinRequired extends Error {}

async function call<T>(url: string, init?: RequestInit, extra?: Record<string, string>): Promise<T> {
  const res = await fetch(url, { ...init, headers: { 'Content-Type': 'application/json', 'x-app-pin': getPin(), ...extra } });
  if (res.status === 401) throw new PinRequired();
  if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error ?? `HTTP ${res.status}`);
  return res.json() as Promise<T>;
}

export const fetchProgress = (level: number) => call<{ done: string[] }>(`/api/progress?level=${level}`);

export const saveTask = (level: number, taskId: string, done: boolean) =>
  call<{ done: string[]; completedBox: string | null; emailed: boolean }>('/api/progress', {
    method: 'POST',
    body: JSON.stringify({ level, taskId, done }),
  });

export const saveChapter = (level: number, chapter: number, done: boolean, passcode: string) =>
  call<{ done: string[] }>('/api/progress', { method: 'POST', body: JSON.stringify({ level, chapter, done, passcode }) });

export interface ProblemCoverage {
  available: number[];
  solved: number[];
  learn: number[]; // book pages that have a lesson/example image
  stars: Record<string, number>; // stars earned per solved problem
  learned: string[]; // practice task ids whose Learn was finished
  lock: Record<string, { reason: 'learn' } | { reason: 'previous'; need: number } | { reason: 'box'; need: number }>; // locked problems (by number)
}
export interface ProblemView {
  n: number;
  book?: string;
  page?: number;
  prompt: string;
  images: string[];
  kind?: 'text' | 'puzzle' | 'explain';
  parts: { label: string; choices?: string[] }[];
  puzzle?: PuzzleSpec;
  hasBookHint?: boolean;
  solved: boolean;
  attempts: number;
}
export interface CheckResult {
  correct: boolean;
  stars?: number;
  attempts: number;
  hint?: string;
  hintFrom?: 'book' | 'ai';
  hintsLeft?: boolean;
  results?: { label: string; ok: boolean }[];
}
export const fetchCoverage = (level: number, chapter: number) =>
  call<ProblemCoverage>(`/api/problems?level=${level}&chapter=${chapter}`);
export const fetchProblem = (level: number, chapter: number, n: number) =>
  call<ProblemView>(`/api/problems?level=${level}&chapter=${chapter}&n=${n}`);
export const checkProblem = (level: number, chapter: number, n: number, answers: Record<string, string>, cells?: Cells) =>
  call<CheckResult>('/api/problems', { method: 'POST', body: JSON.stringify({ level, chapter, n, answers, cells }) });
export const problemImageUrl = (id: string) => `/api/problem-image?id=${encodeURIComponent(id)}&pin=${encodeURIComponent(getPin())}`;
export const learnImageUrl = (level: number, chapter: number, page: number) => problemImageUrl(`${level}-c${chapter}-learn-${page}`);

export const markLearned = (level: number, chapter: number, taskId: string) =>
  call<{ ok: true }>('/api/problems', { method: 'POST', body: JSON.stringify({ action: 'learned', level, chapter, taskId }) });

export interface Review {
  answer: string;
  solution: string;
  solutionImages: string[];
  tries: number;
  stars: number;
  history: { at: string; kind: 'wrong' | 'solved'; answers?: Record<string, string>; cells?: Cells; hint?: string; hintFrom?: 'book' | 'ai' }[];
  solutionCells?: Cells;
}
/** Official solution + every try, shown after a problem is solved. */
export const fetchReview = (level: number, chapter: number, n: number) =>
  call<Review>(`/api/problems?level=${level}&chapter=${chapter}&n=${n}&review=1`);
export const solutionImageUrl = problemImageUrl;
