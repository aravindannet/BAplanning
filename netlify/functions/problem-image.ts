import type { Config } from '@netlify/functions';
import { isMongoConfigured, problemImagesCol, problemsCol } from './_mongo';

// Serves QUESTION images and lesson pages only. Solution images are never exposed: an id is only served if some
// problem lists it under images.question.
export default async (req: Request): Promise<Response> => {
  const pin = process.env.APP_PIN;
  const url = new URL(req.url);
  if (pin && (req.headers.get('x-app-pin') ?? url.searchParams.get('pin')) !== pin) return new Response('pin_required', { status: 401 });
  if (!isMongoConfigured()) return new Response('MONGODB_URI is not configured', { status: 503 });
  const id = url.searchParams.get('id') ?? '';
  // Lesson pages (`<level>-c<chapter>-learn-<page>`) are the book's examples, not answers, so they are served too.
  const isLearn = /^\d+-c\d+-learn-\d+$/.test(id);
  // Solution images only for a parent (passcode in `code`; <img> tags can't send headers).
  const code = process.env.CHAPTER_PASSCODE;
  const parent = !code || url.searchParams.get('code') === code;
  const owner = isLearn || (parent && (await (await problemsCol()).findOne({ 'images.solution': id }, { projection: { _id: 1 } }))) || (await (await problemsCol()).findOne({ 'images.question': id }, { projection: { _id: 1 } }));
  if (!owner) return new Response('not found', { status: 404 });
  const img = await (await problemImagesCol()).findOne({ _id: id });
  if (!img) return new Response('not found', { status: 404 });
  return new Response(Buffer.from(img.data.buffer), { headers: { 'Content-Type': img.mime, 'Cache-Control': 'private, max-age=86400' } });
};

export const config: Config = { path: '/api/problem-image' };
