import type { Config } from '@netlify/functions';
import { isMongoConfigured, problemsCol, problemStateCol } from './_mongo';
import { checkAnswer } from './_answer';
import { makeHint } from './_hint';

const MAX_HINTS_PER_DAY = 3;
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } });

function authorized(req: Request): boolean {
  const pin = process.env.APP_PIN;
  return !pin || req.headers.get('x-app-pin') === pin;
}
const pid = (level: unknown, chapter: unknown, n: unknown) => `${Number(level)}-c${Number(chapter)}-${Number(n)}`;

export default async (req: Request): Promise<Response> => {
  if (!authorized(req)) return json({ error: 'pin_required' }, 401);
  if (!isMongoConfigured()) return json({ error: 'MONGODB_URI is not configured' }, 503);
  const problems = await problemsCol();
  const states = await problemStateCol();

  if (req.method === 'GET') {
    const q = new URL(req.url).searchParams;
    const level = Number(q.get('level'));
    const chapter = Number(q.get('chapter'));
    if (!level || !chapter) return json({ error: 'level and chapter required' }, 400);
    const n = q.get('n');
    if (n === null) {
      // coverage: which problem numbers have content, and which are solved
      const docs = await problems.find({ level, chapter }, { projection: { n: 1 } }).toArray();
      const ids = docs.map((d) => d._id);
      const solved = await states.find({ _id: { $in: ids }, solved: true }).toArray();
      return json({ available: docs.map((d) => d.n), solved: solved.map((s) => Number(s._id.split('-').pop())) });
    }
    const p = await problems.findOne({ _id: pid(level, chapter, n) });
    if (!p) return json({ error: 'not found' }, 404);
    const st = await states.findOne({ _id: p._id });
    // answers and solution stay on the server
    return json({
      n: p.n,
      book: p.book,
      page: p.page,
      prompt: p.prompt,
      images: p.images.question,
      parts: p.parts.map((x) => ({ label: x.label })),
      solved: st?.solved ?? false,
      attempts: st?.attempts ?? 0,
    });
  }

  if (req.method === 'POST') {
    let body: { level?: unknown; chapter?: unknown; n?: unknown; answers?: Record<string, unknown> };
    try {
      body = await req.json();
    } catch {
      return json({ error: 'invalid json' }, 400);
    }
    const id = pid(body.level, body.chapter, body.n);
    const p = await problems.findOne({ _id: id });
    if (!p) return json({ error: 'not found' }, 404);
    const answers = body.answers ?? {};
    const results = p.parts.map((part) => ({ label: part.label, ok: checkAnswer(String(answers[part.label] ?? ''), [part.answer, ...part.accepted]) }));
    const correct = results.every((r) => r.ok);

    if (correct) {
      await states.updateOne({ _id: id }, { $set: { solved: true, attempts: 0 } }, { upsert: true });
      return json({ correct: true, results, attempts: 0 });
    }

    const st = await states.findOneAndUpdate({ _id: id }, { $inc: { attempts: 1 } }, { upsert: true, returnDocument: 'after' });
    const attempts = st?.attempts ?? 1;
    const wrongText = p.parts.map((part, i) => `${part.label}: ${String(answers[part.label] ?? '')}${results[i].ok ? ' (right)' : ''}`).join('; ');
    let hint: string | undefined;
    let hintsLeft = true;
    if (attempts >= 2) {
      const today = new Date().toISOString().slice(0, 10);
      const used = st?.hintDay === today ? (st.hintCount ?? 0) : 0;
      if (used >= MAX_HINTS_PER_DAY) {
        hintsLeft = false;
      } else {
        hint = (await makeHint(p, wrongText)).hint;
        await states.updateOne({ _id: id }, { $set: { hintDay: today, hintCount: used + 1 } });
      }
    }
    // only report which parts were right for multi-part problems
    return json({ correct: false, results: p.parts.length > 1 ? results : undefined, attempts, hint, hintsLeft });
  }

  return json({ error: 'method not allowed' }, 405);
};

export const config: Config = { path: '/api/problems' };
