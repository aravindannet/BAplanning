import type { Config } from '@netlify/functions';
import { isMongoConfigured, problemImagesCol, problemsCol, problemStateCol, type HistoryEntry } from './_mongo';
import { checkAnswer } from './_answer';
import { makeHint } from './_hint';
import { getPlan, type PlanChapter } from './_plan';
import { firstRequiredUnsolved, gateTask, practiceTasks, starsFor, type LockReason } from './_gate';

const MAX_HINTS_PER_DAY = 3;
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } });

function authorized(req: Request): boolean {
  const pin = process.env.APP_PIN;
  return !pin || req.headers.get('x-app-pin') === pin;
}
const pid = (level: unknown, chapter: unknown, n: unknown) => `${Number(level)}-c${Number(chapter)}-${Number(n)}`;

/** Everything the order rules need to know about one chapter. */
async function chapterState(level: number, chapter: PlanChapter) {
  const problems = await problemsCol();
  const states = await problemStateCol();
  const docs = await problems.find({ level, chapter: chapter.number }, { projection: { n: 1 } }).toArray();
  const available = new Set(docs.map((d) => d.n));
  const ids = docs.map((d) => d._id);
  const tasks = practiceTasks(chapter);
  // independent queries run together (each Mongo round trip is slow from a laptop)
  const [solvedDocs, learnDocs, learnedDocs] = await Promise.all([
    states.find({ _id: { $in: ids }, solved: true }).toArray(),
    (await problemImagesCol()).find({ _id: { $regex: `^${level}-c${chapter.number}-learn-\\d+$` } as never }, { projection: { _id: 1 } }).toArray(),
    states.find({ _id: { $in: tasks.map((t) => `learn-${t.id}`) } }).toArray(),
  ]);
  const solved = new Set(solvedDocs.map((s) => Number(s._id.split('-').pop())));
  const stars: Record<number, number> = Object.fromEntries(solvedDocs.map((s) => [Number(s._id.split('-').pop()), s.stars ?? 3]));
  const learnPages = new Set(learnDocs.map((d) => Number(String(d._id).split('-').pop())));
  const learnedTasks = new Set(learnedDocs.filter((d) => d.learned).map((d) => d._id.replace('learn-', '')));
  const lock = new Map<number, LockReason>();
  // boxes open in order: a task stays locked until every required problem in the earlier boxes is solved
  let blockedBy: number | null = null;
  const learnLock = new Map<string, number>(); // practice tasks whose Learn is also locked (earlier box unfinished)
  for (const t of tasks) {
    if (blockedBy !== null && (t.problems ?? []).some((p) => available.has(p.n))) learnLock.set(t.id, blockedBy);
    for (const [n, r] of gateTask(t, { available, solved, learnPages, learned: learnedTasks.has(t.id), blockedBy })) lock.set(n, r);
    if (blockedBy === null) blockedBy = firstRequiredUnsolved(t, available, solved);
  }
  return { available, solved, stars, learnPages, learnedTasks, lock, learnLock };
}

const lockedResponse = (r: LockReason) => json({ error: 'locked', ...r }, 403);

export default async (req: Request): Promise<Response> => {
  if (!authorized(req)) return json({ error: 'pin_required' }, 401);
  if (!isMongoConfigured()) return json({ error: 'MONGODB_URI is not configured' }, 503);
  const problems = await problemsCol();
  const states = await problemStateCol();

  if (req.method === 'GET') {
    const q = new URL(req.url).searchParams;
    const level = Number(q.get('level'));
    const chapterNo = Number(q.get('chapter'));
    const plan = getPlan(String(level));
    const chapter = plan?.chapters.find((c) => c.number === chapterNo);
    if (!chapter) return json({ error: 'level and chapter required' }, 400);

    const n = q.get('n');
    const cs = await chapterState(level, chapter);
    if (n === null) {
      // coverage + order rules, so the UI can show locks (the server enforces them too)
      return json({
        available: [...cs.available],
        solved: [...cs.solved],
        stars: cs.stars,
        learn: [...cs.learnPages],
        learned: [...cs.learnedTasks],
        // problem locks keyed by problem number, plus `learn:<taskId>` for a task whose Learn is locked
        lock: { ...Object.fromEntries([...cs.lock].map(([k, v]) => [k, v])), ...Object.fromEntries([...cs.learnLock].map(([id, need]) => [`learn:${id}`, { reason: 'box', need }])) },
      });
    }
    const p = await problems.findOne({ _id: pid(level, chapterNo, n) });
    if (!p) return json({ error: 'not found' }, 404);
    // Review (official solution + every try): only once the problem is solved, so it can't be peeked at.
    if (q.get('review') === '1') {
      const s = await states.findOne({ _id: p._id });
      if (!s?.solved) return json({ error: 'not_solved' }, 403);
      return json({
        answer: p.parts.map((x) => (p.parts.length > 1 ? `${x.label}: ${x.answer}` : x.answer)).join(' · '),
        solution: p.solution,
        solutionImages: p.images.solution,
        tries: s.tries ?? s.history?.filter((h) => h.kind === 'wrong').length ?? 0,
        stars: s.stars ?? 3,
        history: s.history ?? [],
      });
    }
    const lock = cs.lock.get(p.n);
    if (lock) return lockedResponse(lock);
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
    let body: { action?: string; level?: unknown; chapter?: unknown; n?: unknown; taskId?: unknown; answers?: Record<string, unknown> };
    try {
      body = await req.json();
    } catch {
      return json({ error: 'invalid json' }, 400);
    }
    const level = Number(body.level);
    const chapterNo = Number(body.chapter);
    const chapter = getPlan(String(level))?.chapters.find((c) => c.number === chapterNo);
    if (!chapter) return json({ error: 'unknown chapter' }, 400);

    // Learn finished for a practice task
    if (body.action === 'learned') {
      const task = practiceTasks(chapter).find((t) => t.id === String(body.taskId));
      if (!task) return json({ error: 'unknown task' }, 400);
      const need = (await chapterState(level, chapter)).learnLock.get(task.id);
      if (need !== undefined) return lockedResponse({ reason: 'box', need });
      await states.updateOne({ _id: `learn-${task.id}` }, { $set: { learned: true, solved: false, attempts: 0 } }, { upsert: true });
      return json({ ok: true });
    }
    const id = pid(level, chapterNo, body.n);
    const p = await problems.findOne({ _id: id });
    if (!p) return json({ error: 'not found' }, 404);
    // order rules (server-side): Learn first, then one problem at a time
    const lock = (await chapterState(level, chapter)).lock.get(p.n);
    if (lock) return lockedResponse(lock);

    const answers = Object.fromEntries(Object.entries(body.answers ?? {}).map(([k, v]) => [k, String(v).slice(0, 200)]));
    const results = p.parts.map((part) => ({ label: part.label, ok: checkAnswer(answers[part.label] ?? '', [part.answer, ...part.accepted]) }));
    const correct = results.every((r) => r.ok);
    const now = new Date().toISOString();

    if (correct) {
      const entry: HistoryEntry = { at: now, kind: 'solved', answers };
      const before = await states.findOne({ _id: id });
      // stars come from the wrong answers since the last solve (a re-solve after Reset starts fresh)
      const stars = before?.solved ? (before.stars ?? 3) : starsFor(before?.attempts ?? 0);
      await states.updateOne({ _id: id }, { $set: { solved: true, attempts: 0, stars }, $push: { history: entry } }, { upsert: true });
      return json({ correct: true, results, attempts: 0, stars });
    }

    const st = await states.findOneAndUpdate({ _id: id }, { $inc: { attempts: 1, tries: 1 } }, { upsert: true, returnDocument: 'after' });
    const attempts = st?.attempts ?? 1;
    const wrongText = p.parts.map((part, i) => `${part.label}: ${answers[part.label] ?? ''}${results[i].ok ? ' (right)' : ''}`).join('; ');
    let hint: string | undefined;
    let hintsLeft = true;
    if (attempts >= 2) {
      const today = now.slice(0, 10);
      const used = st?.hintDay === today ? (st.hintCount ?? 0) : 0;
      if (used >= MAX_HINTS_PER_DAY) {
        hintsLeft = false;
      } else {
        const level = (st?.history?.filter((h) => h.hint).length ?? 0) + 1; // hints already shown for this problem + 1
        hint = (await makeHint(p, wrongText, level)).hint;
        await states.updateOne({ _id: id }, { $set: { hintDay: today, hintCount: used + 1 } });
      }
    }
    const entry: HistoryEntry = { at: now, kind: 'wrong', answers, ...(hint ? { hint } : {}) };
    await states.updateOne({ _id: id }, { $push: { history: entry } });
    // only report which parts were right for multi-part problems
    return json({ correct: false, results: p.parts.length > 1 ? results : undefined, attempts, hint, hintsLeft });
  }

  return json({ error: 'method not allowed' }, 405);
};

export const config: Config = { path: '/api/problems' };

