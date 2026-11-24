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

async function call<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, { ...init, headers: { 'Content-Type': 'application/json', 'x-app-pin': getPin() } });
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
}
export interface ProblemView {
  n: number;
  book?: string;
  page?: number;
  prompt: string;
  images: string[];
  parts: { label: string }[];
  solved: boolean;
  attempts: number;
}
export interface CheckResult {
  correct: boolean;
  attempts: number;
  hint?: string;
  hintsLeft?: boolean;
  results?: { label: string; ok: boolean }[];
}
export const fetchCoverage = (level: number, chapter: number) =>
  call<ProblemCoverage>(`/api/problems?level=${level}&chapter=${chapter}`);
export const fetchProblem = (level: number, chapter: number, n: number) =>
  call<ProblemView>(`/api/problems?level=${level}&chapter=${chapter}&n=${n}`);
export const checkProblem = (level: number, chapter: number, n: number, answers: Record<string, string>) =>
  call<CheckResult>('/api/problems', { method: 'POST', body: JSON.stringify({ level, chapter, n, answers }) });
export const problemImageUrl = (id: string) => `/api/problem-image?id=${encodeURIComponent(id)}&pin=${encodeURIComponent(getPin())}`;
