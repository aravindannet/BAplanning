// Loads scanned practice questions + solutions into MongoDB.
//   node --env-file=.env scripts/import-problems.mjs <questions.pdf> <level> <chapter> [solutions.pdf] [--book 4B] [--db <name>] [--render-only] [--model <id>]
// Each PDF page is rendered to an image and read by Claude vision. A page may hold questions,
// solutions, or both; they are merged by problem number. Writes a review page to
// ./.import-review/<level>-c<chapter>/index.html so the result can be spot-checked.
import fs from 'node:fs';
import path from 'node:path';
import dns from 'node:dns';
import * as pdfjs from 'pdfjs-dist/legacy/build/pdf.mjs';
import { createCanvas } from '@napi-rs/canvas';
import { MongoClient, Binary } from 'mongodb';

dns.setServers(['8.8.8.8', '8.8.4.4']);

const args = process.argv.slice(2);
const flag = (name) => {
  const i = args.indexOf(name);
  if (i === -1) return null;
  return args.splice(i, 2)[1];
};
const renderOnly = args.includes('--render-only') && args.splice(args.indexOf('--render-only'), 1);
const dbName = flag('--db') || process.env.MONGODB_DB || 'beast_academy';
const MODEL = flag('--model') || 'claude-sonnet-5-5';
const BOOK = flag('--book') || undefined;
const [src, level, chapter, solutions] = args;
if (!src || !level || !chapter) {
  console.error('usage: import-problems.mjs <questions.pdf> <level> <chapter> [solutions.pdf] [--book 4B] [--db name] [--render-only] [--model id]');
  process.exit(1);
}
const outDir = path.resolve('.import-review', `${level}-c${chapter}`);
fs.mkdirSync(outDir, { recursive: true });

const files = [src, solutions].filter(Boolean).flatMap((x) =>
  fs.statSync(x).isDirectory() ? fs.readdirSync(x).filter((f) => /\.pdf$/i.test(f)).sort().map((f) => path.join(x, f)) : [x],
);

const SCALE = 2; // ~144 dpi: readable for the model, small enough for Mongo
async function renderPages(file) {
  const doc = await pdfjs.getDocument({ data: new Uint8Array(fs.readFileSync(file)), isEvalSupported: false }).promise;
  const pages = [];
  for (let p = 1; p <= doc.numPages; p++) {
    const page = await doc.getPage(p);
    const vp = page.getViewport({ scale: SCALE });
    const canvas = createCanvas(Math.ceil(vp.width), Math.ceil(vp.height));
    await page.render({ canvasContext: canvas.getContext('2d'), viewport: vp }).promise;
    pages.push({ file: path.basename(file), page: p, canvas });
  }
  return pages;
}

const PROMPT = `This is one scanned page from a Beast Academy practice book (math, grade 4-5). It may contain practice QUESTIONS, their SOLUTIONS/answer key, or both.
Return ONLY JSON: {"bookPage": number|null, "items":[{ "n": problem number, "kind": "question"|"solution", "part": null, ...}]}
For kind "question": {"n","kind":"question","prompt": full problem text transcribed exactly (use plain text; write fractions like 3/4; keep part labels (a),(b) inside the text), "parts":[{"label":"a"}] (use [{"label":"answer"}] if one answer; one entry per lettered part / blank the child must fill), "figure": null or {"x":0-1,"y":0-1,"w":0-1,"h":0-1} bounding box (fractions of the page) of any picture/diagram/grid needed to solve it}.
For kind "solution": {"n","kind":"solution","answers":[{"label": same labels as the question or "answer","answer": final answer as short text,"accepted":[other equivalent forms]}],"solution": the full worked solution text exactly as written, "figure": null or bbox of any solution diagram}.
Problem numbers are the bold numbers beside each problem. Do not invent content. If a page has none, return {"bookPage":null,"items":[]}.`;

async function readPage(png) {
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-api-key': process.env.ANTHROPIC_API_KEY, 'anthropic-version': '2023-06-01' },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: 8000,
      messages: [{ role: 'user', content: [{ type: 'image', source: { type: 'base64', media_type: 'image/png', data: png.toString('base64') } }, { type: 'text', text: PROMPT }] }],
    }),
  });
  if (!res.ok) throw new Error(`Anthropic ${res.status}: ${(await res.text()).slice(0, 300)}`);
  const data = await res.json();
  const text = data.content.filter((c) => c.type === 'text').map((c) => c.text).join('');
  const m = text.match(/\{[\s\S]*\}/);
  if (!m) throw new Error('no JSON in model reply');
  return JSON.parse(m[0]);
}

function crop(canvas, f) {
  const x = Math.max(0, Math.floor(f.x * canvas.width) - 8);
  const y = Math.max(0, Math.floor(f.y * canvas.height) - 8);
  const w = Math.min(canvas.width - x, Math.ceil(f.w * canvas.width) + 16);
  const h = Math.min(canvas.height - y, Math.ceil(f.h * canvas.height) + 16);
  if (w < 20 || h < 20) return null;
  const c = createCanvas(w, h);
  c.getContext('2d').drawImage(canvas, x, y, w, h, 0, 0, w, h);
  return c.toBuffer('image/jpeg', 85);
}

const pages = (await Promise.all(files.map(renderPages))).flat();
console.log(`${files.length} file(s), ${pages.length} page(s) rendered`);
pages.forEach((p, i) => fs.writeFileSync(path.join(outDir, `page-${i + 1}.png`), p.canvas.toBuffer('image/png')));
if (renderOnly) process.exit(0);
if (!process.env.ANTHROPIC_API_KEY) throw new Error('ANTHROPIC_API_KEY missing (run with --env-file=.env)');

const byN = new Map(); // n -> {q, s, qImgs, sImgs, book, page}
const images = [];
let idx = 0;
for (const pg of pages) {
  idx++;
  let out;
  for (let attempt = 1; attempt <= 3 && !out; attempt++) {
    try {
      out = await readPage(pg.canvas.toBuffer('image/png'));
    } catch (e) {
      console.warn(`page ${idx} attempt ${attempt}: ${e.message}`);
    }
  }
  if (!out) {
    console.warn(`page ${idx} SKIPPED`);
    continue;
  }
  for (const it of out.items ?? []) {
    const n = Number(it.n);
    if (!n) continue;
    const e = byN.get(n) ?? { qImgs: [], sImgs: [] };
    if (it.kind === 'question') {
      e.q = it;
      e.page = out.bookPage ?? undefined;
      e.srcPage = idx;
    } else {
      e.s = it;
    }
    if (it.figure) {
      const buf = crop(pg.canvas, it.figure);
      if (buf) {
        const id = `${level}-c${chapter}-${n}-${it.kind === 'question' ? 'q' : 's'}${(it.kind === 'question' ? e.qImgs : e.sImgs).length + 1}`;
        images.push({ _id: id, mime: 'image/jpeg', data: new Binary(buf), buf });
        (it.kind === 'question' ? e.qImgs : e.sImgs).push(id);
      }
    }
    byN.set(n, e);
  }
  console.log(`page ${idx}/${pages.length}: ${(out.items ?? []).length} items`);
}

const docs = [];
const problems = [];
for (const [n, e] of [...byN].sort((a, b) => a[0] - b[0])) {
  if (!e.q || !e.s) {
    problems.push(`#${n}: missing ${!e.q ? 'question' : 'solution'}`);
    continue;
  }
  const labels = e.q.parts?.length ? e.q.parts.map((x) => x.label) : ['answer'];
  const ans = e.s.answers ?? [];
  const parts = labels.map((label, i) => {
    const a = ans.find((x) => x.label === label) ?? ans[i] ?? ans[0];
    return { label, answer: String(a?.answer ?? ''), accepted: (a?.accepted ?? []).map(String) };
  });
  if (parts.some((p) => !p.answer)) problems.push(`#${n}: missing answer`);
  docs.push({
    _id: `${level}-c${chapter}-${n}`,
    level: Number(level),
    chapter: Number(chapter),
    n,
    book: BOOK,
    page: e.page,
    prompt: e.q.prompt,
    parts,
    solution: e.s.solution,
    images: { question: e.qImgs, solution: e.sImgs },
  });
}
console.log(`${docs.length} complete problems; ${problems.length} issue(s)`);
problems.forEach((p) => console.log('  ' + p));

// review page
fs.writeFileSync(
  path.join(outDir, 'index.html'),
  `<meta charset=utf-8><style>body{font:15px system-ui;max-width:900px;margin:20px auto}.p{border:1px solid #ccc;padding:12px;margin:12px 0}img{max-width:300px}pre{white-space:pre-wrap}</style><h1>Level ${level} chapter ${chapter}: ${docs.length} problems</h1><p style=color:#b00>${problems.join('<br>')}</p>` +
    docs
      .map((d) => `<div class=p><b>#${d.n}</b> (page ${d.page ?? '?'})<pre>${d.prompt}</pre>${d.images.question.map((i) => `<img src="img-${i}.jpg">`).join('')}<b>Answer:</b> ${d.parts.map((p) => `${p.label}=${p.answer}`).join(' | ')}<pre>${d.solution}</pre>${d.images.solution.map((i) => `<img src="img-${i}.jpg">`).join('')}</div>`)
      .join(''),
);
images.forEach((i) => fs.writeFileSync(path.join(outDir, `img-${i._id}.jpg`), i.buf));
console.log(`review page: ${path.join(outDir, 'index.html')}`);

const client = await new MongoClient(process.env.MONGODB_URI).connect();
const db = client.db(dbName);
for (const d of docs) await db.collection('problems').replaceOne({ _id: d._id }, d, { upsert: true });
for (const i of images) await db.collection('problem_images').replaceOne({ _id: i._id }, { _id: i._id, mime: i.mime, data: i.data }, { upsert: true });
await client.close();
console.log(`wrote ${docs.length} problems, ${images.length} images to db "${dbName}"`);
