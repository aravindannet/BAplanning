import { MongoClient, type Collection } from 'mongodb';
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
