import type { Config } from '@netlify/functions';
import { isMongoConfigured, problemImagesCol, problemsCol } from './_mongo';

// Serves QUESTION images only. Solution images are never exposed: an id is only served if some
// problem lists it under images.question.
export default async (req: Request): Promise<Response> => {
  const pin = process.env.APP_PIN;
  const url = new URL(req.url);
  if (pin && (req.headers.get('x-app-pin') ?? url.searchParams.get('pin')) !== pin) return new Response('pin_required', { status: 401 });
  if (!isMongoConfigured()) return new Response('MONGODB_URI is not configured', { status: 503 });
  const id = url.searchParams.get('id') ?? '';
  const owner = await (await problemsCol()).findOne({ 'images.question': id }, { projection: { _id: 1 } });
  if (!owner) return new Response('not found', { status: 404 });
  const img = await (await problemImagesCol()).findOne({ _id: id });
  if (!img) return new Response('not found', { status: 404 });
  return new Response(Buffer.from(img.data.buffer), { headers: { 'Content-Type': img.mime, 'Cache-Control': 'private, max-age=86400' } });
};

export const config: Config = { path: '/api/problem-image' };
