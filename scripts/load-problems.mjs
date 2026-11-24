// Loads a hand-checked problem set module (default export: array of {n,page,prompt,parts,solution}) into MongoDB.
//   node --env-file=.env scripts/load-problems.mjs <data.mjs> <level> <chapter> --book 4B [--db name]
import dns from 'node:dns';
import path from 'node:path';
import { MongoClient } from 'mongodb';
dns.setServers(['8.8.8.8', '8.8.4.4']);
const args = process.argv.slice(2);
const flag = (n) => { const i = args.indexOf(n); return i === -1 ? null : args.splice(i, 2)[1]; };
const book = flag('--book');
const dbName = flag('--db') || process.env.MONGODB_DB || 'beast_academy';
const [file, level, chapter] = args;
const probs = (await import(path.resolve(file))).default;
const client = await new MongoClient(process.env.MONGODB_URI).connect();
const col = client.db(dbName).collection('problems');
for (const p of probs) {
  const _id = `${level}-c${chapter}-${p.n}`;
  await col.replaceOne({ _id }, { _id, level: Number(level), chapter: Number(chapter), n: p.n, book, page: p.page, prompt: p.prompt, parts: p.parts, solution: p.solution, images: { question: [], solution: [] } }, { upsert: true });
}
await client.close();
console.log(`loaded ${probs.length} problems into "${dbName}"`);
