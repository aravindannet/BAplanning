import type { Config } from '@netlify/functions';
import { withMongo, isMongoConfigured, problemImagesCol, problemsCol, problemStateCol } from './_mongo';

// Serves question images, lesson pages, and (once the problem is solved) its solution images.
export default withMongo(async (req: Request): Promise<Response> => {
  const pin = process.env.APP_PIN;
  const url = new URL(req.url);
  if (pin && (req.headers.get('x-app-pin') ?? url.searchParams.get('pin')) !== pin) return new Response('pin_required', { status: 401 });
  if (!isMongoConfigured()) return new Response('MONGODB_URI is not configured', { status: 503 });
  const id = url.searchParams.get('id') ?? '';
  // Lesson pages (`<level>-c<chapter>-learn-<page>`) are the book's examples, not answers, so they are served too.
  const isLearn = /^\d+-c\d+-learn-\d+$/.test(id);
  const problems = await problemsCol();
  // Solution images are served only for a problem the kid has already solved.
  let owner = isLearn || (await problems.findOne({ 'images.question': id }, { projection: { _id: 1 } }));
  if (!owner) {
    const sol = await problems.findOne({ 'images.solution': id }, { projection: { _id: 1 } });
    owner = sol && (await (await problemStateCol()).findOne({ _id: sol._id, solved: true }, { projection: { _id: 1 } })) ? sol : null;
  }
  if (!owner) return new Response('not found', { status: 404 });
  const img = await (await problemImagesCol()).findOne({ _id: id });
  if (!img) return new Response('not found', { status: 404 });
  return new Response(Buffer.from(img.data.buffer), { headers: { 'Content-Type': img.mime, 'Cache-Control': 'private, max-age=86400' } });
});

export const config: Config = { path: '/api/problem-image' };
