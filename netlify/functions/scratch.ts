import type { Config } from '@netlify/functions';
import { isMongoConfigured, scratchCol, withMongo } from './_mongo';
import { sanitize } from './_scratch';

// Rough-note pages, one per problem. Never deleted; an older save can't overwrite a newer one.
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } });
const pid = (level: unknown, chapter: unknown, n: unknown) => {
  const [l, c, x] = [Number(level), Number(chapter), Number(n)];
  return Number.isInteger(l) && Number.isInteger(c) && Number.isInteger(x) && l > 0 && c > 0 && x > 0 ? `${l}-c${c}-${x}` : null;
};

export default withMongo(async (req: Request): Promise<Response> => {
  const pin = process.env.APP_PIN;
  if (pin && req.headers.get('x-app-pin') !== pin) return json({ error: 'pin_required' }, 401);
  if (!isMongoConfigured()) return json({ error: 'MONGODB_URI is not configured' }, 503);
  const col = await scratchCol();

  if (req.method === 'GET') {
    const q = new URL(req.url).searchParams;
    const id = pid(q.get('level'), q.get('chapter'), q.get('n'));
    if (!id) return json({ error: 'level, chapter and n required' }, 400);
    const doc = await col.findOne({ _id: id });
    return json(doc ? { strokes: doc.strokes, updatedAt: doc.updatedAt } : { strokes: [], updatedAt: 0 });
  }

  if (req.method === 'PUT' || req.method === 'POST') {
    const raw = await req.text();
    if (raw.length > 1_500_000) return json({ error: 'too_big' }, 413);
    let body: { level?: unknown; chapter?: unknown; n?: unknown };
    try {
      body = JSON.parse(raw);
    } catch {
      return json({ error: 'invalid json' }, 400);
    }
    const id = pid(body.level, body.chapter, body.n);
    const data = sanitize(body);
    if (!id || !data) return json({ error: 'invalid' }, 400);
    // only replace an older copy (a late, stale save never wins)
    const r = await col.updateOne({ _id: id, $or: [{ updatedAt: { $lt: data.updatedAt } }, { updatedAt: { $exists: false } }] }, { $set: data }, { upsert: false });
    if (!r.matchedCount) {
      const exists = await col.findOne({ _id: id }, { projection: { updatedAt: 1 } });
      if (!exists) await col.insertOne({ _id: id, ...data }).catch(() => {}); // a racing insert loses quietly
    }
    const now = await col.findOne({ _id: id }, { projection: { updatedAt: 1 } });
    return json({ ok: true, updatedAt: now?.updatedAt ?? data.updatedAt });
  }

  return json({ error: 'method not allowed' }, 405);
});

export const config: Config = { path: '/api/scratch' };
