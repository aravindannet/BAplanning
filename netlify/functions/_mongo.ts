import { MongoClient, type Binary, type Collection, type Db } from 'mongodb';
import type { Cells, PuzzleSpec } from './_puzzle';
import dns from 'dns';

// Some ISPs/resolvers can't resolve MongoDB SRV records; same workaround as the other projects.
dns.setServers(['8.8.8.8', '8.8.4.4']);

export interface ProgressDoc {
  _id: string; // `L${level}`
  done: string[]; // completed task ids
  notified: string[]; // box ids whose completion email has been sent (dedupe)
  updatedAt: string;
}

// One client per warm function instance. On Netlify a warm function handles request after request with
// the same module state, so the client is reused. The local dev server (netlify dev) instead runs every
// request in a fresh worker, so there the client is closed when the request finishes (see withMongo);
// otherwise each request would leave its sockets open until the cluster's connection limit is hit.
let clientPromise: Promise<MongoClient> | null = null;
const DEV = process.env.NETLIFY_DEV === 'true';
let active = 0; // requests in flight (dev only)

export function isMongoConfigured(): boolean {
  return Boolean(process.env.MONGODB_URI);
}

async function getClient(): Promise<MongoClient> {
  const uri = process.env.MONGODB_URI;
  if (!uri) throw new Error('MONGODB_URI is not configured');
  if (!clientPromise) {
    // Free-tier Atlas caps connections for every app on the cluster. One pooled connection per server,
    // idle sockets dropped after 10 s, and 'poll' monitoring (no extra round-trip socket per server).
    clientPromise = new MongoClient(uri, {
      maxPoolSize: 1,
      minPoolSize: 0,
      maxIdleTimeMS: 10_000,
      serverMonitoringMode: 'poll',
      appName: 'beast-academy',
    }).connect().catch((err) => {
      clientPromise = null;
      throw err;
    });
  }
  return clientPromise;
}

/**
 * Wraps a function handler. In local dev the client is closed once no request is using it any more, so
 * slow non-database work in the middle of a request (an AI hint, an email) can never lose its connection.
 * On Netlify it does nothing extra: the warm instance keeps reusing its client.
 */
export function withMongo(handler: (req: Request) => Promise<Response>): (req: Request) => Promise<Response> {
  if (!DEV) return handler;
  return async (req) => {
    active++;
    try {
      return await handler(req);
    } finally {
      active--;
      if (active === 0 && clientPromise) {
        const p = clientPromise;
        clientPromise = null;
        void p.then((c) => c.close()).catch(() => {});
      }
    }
  };
}

export async function getProgressCollection(): Promise<Collection<ProgressDoc>> {
  const client = await getClient();
  return client.db(process.env.MONGODB_DB || 'beast_academy').collection<ProgressDoc>('progress');
}

export interface ProblemDoc {
  _id: string; // `${level}-c${chapter}-${n}`
  level: number;
  chapter: number;
  n: number;
  book?: string;
  page?: number;
  prompt: string;
  /** text (typed answers, the default) | puzzle (an interactive board) | explain (written reasoning, judged by the AI) */
  kind?: 'text' | 'puzzle' | 'explain';
  parts: { label: string; answer: string; accepted: string[]; choices?: string[] }[]; // answers never sent to the browser
  puzzle?: PuzzleSpec; // the board layout (public)
  puzzleSolution?: Cells; // never sent to the browser
  bookHint?: string; // the book's own hint (★ problems), shown before any AI hint
  solution: string; // never sent to the browser
  images: { question: string[]; solution: string[] }; // ids in problem_images
}
export interface ProblemImageDoc {
  _id: string;
  mime: string;
  data: Binary;
}
export interface HistoryEntry {
  at: string; // ISO time
  kind: 'wrong' | 'solved';
  answers?: Record<string, string>;
  cells?: Cells; // the board, for puzzles
  hint?: string; // hint shown with this wrong answer
  hintFrom?: 'book' | 'ai';
}
export interface ProblemStateDoc {
  _id: string; // same id as the problem, or `learn-<taskId>` for a finished Learn
  attempts: number; // wrong answers since last solved / reset
  tries?: number; // total wrong answers (for the parent)
  history?: HistoryEntry[]; // every wrong answer (+ hint) and the solve, for the parent
  learned?: boolean; // only on `learn-<taskId>` docs
  stars?: number; // 1-3, earned when solved
  solved: boolean;
  hintDay?: string; // yyyy-mm-dd of hintCount
  hintCount?: number;
  bookHintShown?: boolean;
}

export async function getDb(): Promise<Db> {
  const client = await getClient();
  return client.db(process.env.MONGODB_DB || 'beast_academy');
}
export const problemsCol = async (): Promise<Collection<ProblemDoc>> => (await getDb()).collection<ProblemDoc>('problems');
export const problemImagesCol = async (): Promise<Collection<ProblemImageDoc>> => (await getDb()).collection<ProblemImageDoc>('problem_images');
export const problemStateCol = async (): Promise<Collection<ProblemStateDoc>> => (await getDb()).collection<ProblemStateDoc>('problem_state');
