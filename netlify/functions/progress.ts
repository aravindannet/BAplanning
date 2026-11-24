import type { Config } from '@netlify/functions';
import { getProgressCollection, isMongoConfigured } from './_mongo';
import { findTask, getPlan } from './_plan';
import { sendBoxComplete } from './_notify';

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } });

function authorized(req: Request): boolean {
  const pin = process.env.APP_PIN;
  if (!pin) return true;
  return req.headers.get('x-app-pin') === pin;
}

export default async (req: Request): Promise<Response> => {
  if (!authorized(req)) return json({ error: 'pin_required' }, 401);
  if (!isMongoConfigured()) return json({ error: 'MONGODB_URI is not configured' }, 503);

  const col = await getProgressCollection();

  if (req.method === 'GET') {
    const level = new URL(req.url).searchParams.get('level') ?? '';
    if (!getPlan(level)) return json({ error: 'unknown level' }, 400);
    const doc = await col.findOne({ _id: `L${level}` });
    return json({ done: doc?.done ?? [] });
  }

  if (req.method === 'POST') {
    let body: { level?: unknown; taskId?: unknown; chapter?: unknown; done?: unknown; passcode?: unknown };
    try {
      body = await req.json();
    } catch {
      return json({ error: 'invalid json' }, 400);
    }
    const level = String(body.level ?? '');
    const taskId = String(body.taskId ?? '');
    const done = body.done === true;
    const plan = getPlan(level);
    if (!plan) return json({ error: 'unknown level' }, 400);

    // Whole-chapter action: mark every task in a chapter done (or clear them all).
    if (body.chapter !== undefined) {
      // Parent-only action: needs the chapter passcode (when one is configured).
      const code = process.env.CHAPTER_PASSCODE;
      if (code && String(body.passcode ?? '') !== code) return json({ error: 'wrong_passcode' }, 403);
      const chapter = plan.chapters.find((c) => c.number === Number(body.chapter));
      if (!chapter) return json({ error: 'unknown chapter' }, 400);
      const taskIds = chapter.boxes.flatMap((b) => b.tasks.map((t) => t.id));
      const boxIds = chapter.boxes.map((b) => b.id);
      const now = new Date().toISOString();
      // No per-box emails for a bulk action. Completing marks the boxes as already announced so a
      // later tick/untick doesn't email for them; clearing releases that, so redoing a box in the
      // normal way notifies again.
      const updated = await col.findOneAndUpdate(
        { _id: `L${level}` },
        done
          ? { $addToSet: { done: { $each: taskIds }, notified: { $each: boxIds } }, $set: { updatedAt: now } }
          : { $pull: { done: { $in: taskIds }, notified: { $in: boxIds } }, $set: { updatedAt: now } },
        { upsert: true, returnDocument: 'after' },
      );
      return json({ done: updated?.done ?? [], completedBox: null, emailed: false, chapterTasks: taskIds.length });
    }
    const found = findTask(plan, taskId);
    if (!found) return json({ error: 'unknown task' }, 400);

    const id = `L${level}`;
    const now = new Date().toISOString();
    const updated = await col.findOneAndUpdate(
      { _id: id },
      done
        ? { $addToSet: { done: taskId }, $set: { updatedAt: now }, $setOnInsert: { notified: [] } }
        : { $pull: { done: taskId }, $set: { updatedAt: now }, $setOnInsert: { notified: [] } },
      { upsert: true, returnDocument: 'after' },
    );
    const doneIds = new Set(updated?.done ?? []);

    let completedBox: string | null = null;
    let emailed = false;
    const { box, chapter } = found;
    if (done && box.tasks.every((t) => doneIds.has(t.id))) {
      completedBox = box.id;
      // Claim the notification atomically: only the request that flips `notified` sends the email,
      // so double-taps and un-tick/re-tick never produce a second message.
      const claim = await col.updateOne({ _id: id, notified: { $ne: box.id } }, { $addToSet: { notified: box.id } });
      if (claim.modifiedCount === 1) {
        try {
          emailed = await sendBoxComplete({
            level: plan.level,
            chapterNumber: chapter.number,
            chapterTitle: chapter.title,
            boxTitle: box.title,
            taskCount: box.tasks.length,
            boxesInChapter: chapter.boxes.length,
            boxesDoneInChapter: chapter.boxes.filter((b) => b.tasks.every((t) => doneIds.has(t.id))).length,
          });
        } catch (err) {
          console.error('[progress] notify failed', err);
        }
        // If nothing was sent (error or email not configured yet) release the claim so a later
        // completion can try again once email is set up.
        if (!emailed) await col.updateOne({ _id: id }, { $pull: { notified: box.id } });
      }
    }
    return json({ done: [...doneIds], completedBox, emailed });
  }

  return json({ error: 'method not allowed' }, 405);
};

export const config: Config = { path: '/api/progress' };
