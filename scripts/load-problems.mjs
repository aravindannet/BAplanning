// Loads a hand-checked problem set module (default export: array of {n,page,prompt,parts,solution}) into MongoDB.
//   node --env-file=.env scripts/load-problems.mjs <data.mjs> <level> <chapter> --book 4B [--db name]
import dns from 'node:dns';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { MongoClient } from 'mongodb';
dns.setServers(['8.8.8.8', '8.8.4.4']);
const args = process.argv.slice(2);
const flag = (n) => { const i = args.indexOf(n); return i === -1 ? null : args.splice(i, 2)[1]; };
const book = flag('--book');
const dbName = flag('--db') || process.env.MONGODB_DB || 'beast_academy';
const [file, level, chapter] = args;
const probs = (await import(pathToFileURL(path.resolve(file)).href)).default;
const client = await new MongoClient(process.env.MONGODB_URI).connect();
const col = client.db(dbName).collection('problems');
const OPTIONAL = ['kind', 'puzzle', 'puzzleSolution', 'bookHint'];
for (const p of probs) {
  const _id = `${level}-c${chapter}-${p.n}`;
  const set = { level: Number(level), chapter: Number(chapter), n: p.n, book, page: p.page, prompt: p.prompt, parts: p.parts, solution: p.solution };
  const unset = {};
  for (const f of OPTIONAL) if (p[f] !== undefined) set[f] = p[f]; else unset[f] = '';
  // pictures are linked by the image loaders; a reload keeps them. `hideScan`: the problem is now an
  // interactive board that replaces the scanned question picture, so that picture is dropped.
  if (p.hideScan) set['images.question'] = [];
  const onInsert = p.hideScan ? { 'images.solution': [] } : { images: { question: [], solution: [] } };
  await col.updateOne({ _id }, { $set: set, ...(Object.keys(unset).length ? { $unset: unset } : {}), $setOnInsert: onInsert }, { upsert: true });
}
await client.close();
console.log(`loaded ${probs.length} problems into "${dbName}"`);
