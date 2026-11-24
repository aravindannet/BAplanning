import { MongoClient, type Binary, type Collection, type Db } from 'mongodb';
import dns from 'dns';

// Some ISPs/resolvers can't resolve MongoDB SRV records; same workaround as the other projects.
dns.setServers(['8.8.8.8', '8.8.4.4']);

export interface ProgressDoc {
  _id: string; // `L${level}`
  done: string[]; // completed task ids
  notified: string[]; // box ids whose completion email has been sent (dedupe)
  updatedAt: string;
}

// One client per warm function container.
let clientPromise: Promise<MongoClient> | null = null;

export function isMongoConfigured(): boolean {
  return Boolean(process.env.MONGODB_URI);
}

async function getClient(): Promise<MongoClient> {
  const uri = process.env.MONGODB_URI;
  if (!uri) throw new Error('MONGODB_URI is not configured');
  if (!clientPromise) {
    clientPromise = new MongoClient(uri, { maxPoolSize: 5 }).connect().catch((err) => {
      clientPromise = null;
      throw err;
    });
  }
  return clientPromise;
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
  parts: { label: string; answer: string; accepted: string[] }[]; // never sent to the browser
  solution: string; // never sent to the browser
  images: { question: string[]; solution: string[] }; // ids in problem_images
}
export interface ProblemImageDoc {
  _id: string;
  mime: string;
  data: Binary;
}
export interface ProblemStateDoc {
  _id: string; // same id as the problem
  attempts: number; // wrong answers since last solved / reset
  solved: boolean;
  hintDay?: string; // yyyy-mm-dd of hintCount
  hintCount?: number;
}

export async function getDb(): Promise<Db> {
  const client = await getClient();
  return client.db(process.env.MONGODB_DB || 'beast_academy');
}
export const problemsCol = async (): Promise<Collection<ProblemDoc>> => (await getDb()).collection<ProblemDoc>('problems');
export const problemImagesCol = async (): Promise<Collection<ProblemImageDoc>> => (await getDb()).collection<ProblemImageDoc>('problem_images');
export const problemStateCol = async (): Promise<Collection<ProblemStateDoc>> => (await getDb()).collection<ProblemStateDoc>('problem_state');
