// Converts a Beast Academy "Planning Sequence" PDF into a structured JSON checklist.
//   node scripts/import-plan.mjs <pdf> <level> <out.json>
// Tasks are emitted in the order Guide -> Online -> Practice (the PDF lists Practice before Online).
import fs from 'node:fs';
import * as pdfjs from 'pdfjs-dist/legacy/build/pdf.mjs';
import { parseTask } from './parse-task.mjs';
import { addExtraPractice } from './gaps.mjs';

const RANK = { guide: 0, practice: 1, online: 2 }; // order inside a PDF box
const STD_RE = /^(\d{1,2}\.[A-Z]{1,4}\.[A-Z]\.\d+[a-z]?)(,\s*\d{1,2}\.[A-Z]{1,4}\.[A-Z]\.\d+[a-z]?)*,?$/;

async function readItems(file) {
  const doc = await pdfjs.getDocument({ data: new Uint8Array(fs.readFileSync(file)) }).promise;
  const pages = [];
  for (let p = 1; p <= doc.numPages; p++) {
    const tc = await (await doc.getPage(p)).getTextContent();
    pages.push(
      tc.items
        .filter((i) => i.str.trim())
        .map((i) => ({ s: i.str, x: Math.round(i.transform[4]), y: Math.round(i.transform[5]) })),
    );
  }
  return pages;
}

// Group text fragments into lines (same y), left-to-right. Words split by ligatures arrive as
// separate fragments, so fragments are concatenated as-is (they carry their own spaces).
function toLines(items) {
  const groups = [];
  for (const it of items) {
    const g = groups.find((g) => Math.abs(g.y - it.y) <= 2);
    if (g) g.items.push(it);
    else groups.push({ y: it.y, items: [it] });
  }
  return groups
    .sort((a, b) => b.y - a.y)
    .map((g) => {
      g.items.sort((a, b) => a.x - b.x);
      return { y: g.y, x: g.items[0].x, items: g.items, text: g.items.map((i) => i.s).join('').replace(/\s+/g, ' ').trim() };
    });
}

function parsePage(items, pageNo) {
  const body = items.filter((i) => i.s.trim() !== 'BeastAcademy.com');
  const left = toLines(body.filter((i) => i.x < 230));
  const right = toLines(body.filter((i) => i.x >= 230));

  // --- chapter headers (x ~ 72) ---
  const headers = [];
  const leftBody = [];
  for (let i = 0; i < left.length; i++) {
    const L = left[i];
    if (L.x < 75 && /^Chapter \d+$/.test(L.text)) {
      const title = [];
      while (left[i + 1] && left[i + 1].x < 75) title.push(left[++i].text);
      headers.push({ y: L.y, number: Number(L.text.split(' ')[1]), title: title.join(' ') });
    } else leftBody.push(L);
  }

  // --- boxes are anchored on the right-hand task lines (Guide? Practice? Online?) ---
  const groups = [];
  let cur = null;
  let lastRank = 99;
  let lastKind = null;
  for (const R of right) {
    const m = R.items[0].s.trim().match(/^(Guide|Practice|Online):/);
    if (m) {
      const kind = m[1].toLowerCase();
      if (!cur || RANK[kind] <= lastRank) {
        cur = { lines: [], ys: [] };
        groups.push(cur);
      }
      lastRank = RANK[kind];
      lastKind = kind;
      cur.lines.push({ kind, text: R.items.slice(1).map((i) => i.s).join('').replace(/\s+/g, ' ').trim() });
    } else if (cur && lastKind) {
      cur.lines[cur.lines.length - 1].text += ' ' + R.text; // wrapped continuation
    }
    if (cur) cur.ys.push(R.y);
  }
  const centers = groups.map((g) => (Math.max(...g.ys) + Math.min(...g.ys)) / 2);

  // --- assign left-hand lines (title / Enrichment / standards) to the nearest box ---
  const boxes = groups.map((g, i) => ({ g, center: centers[i], left: [] }));
  for (const L of leftBody) {
    let best = 0;
    let bd = Infinity;
    centers.forEach((c, i) => {
      const d = Math.abs(c - L.y);
      if (d < bd) {
        bd = d;
        best = i;
      }
    });
    if (boxes[best]) boxes[best].left.push(L);
  }

  return boxes.map((b) => {
    const lines = b.left.sort((a, c) => c.y - a.y);
    const title = [];
    const standards = [];
    let enrichment = false;
    for (const L of lines) {
      if (L.text === 'Enrichment') enrichment = true;
      else if (STD_RE.test(L.text)) standards.push(...L.text.split(/,\s*/).filter(Boolean));
      else title.push(L.text);
    }
    return {
      page: pageNo,
      y: b.center,
      title: title.join(' ').trim(),
      enrichment,
      standards,
      raw: Object.fromEntries(b.g.lines.map((l) => [l.kind, l.text])),
    };
  }).concat([]).map((box) => ({ box, headers }));
}

export async function importPlan(file, level) {
  const pages = await readItems(file);
  const chapters = [];
  let chapter = null;
  pages.forEach((items, idx) => {
    const parsed = parsePage(items, idx + 1);
    const pageHeaders = parsed[0]?.headers ?? [];
    // headers may exist on a page with no boxes parsed; recompute independently
    const hdrs = pageHeaders.length ? pageHeaders : [];
    const events = [
      ...hdrs.map((h) => ({ y: h.y, h })),
      ...parsed.map(({ box }) => ({ y: box.y, box })),
    ].sort((a, b) => b.y - a.y);
    for (const ev of events) {
      if (ev.h) {
        chapter = { id: `c${ev.h.number}`, number: ev.h.number, title: ev.h.title, boxes: [] };
        chapters.push(chapter);
      } else if (chapter) {
        const n = chapter.boxes.length + 1;
        const id = `${level}-c${chapter.number}-b${n}`;
        const tasks = ['guide', 'online', 'practice']
          .filter((k) => ev.box.raw[k])
          .map((k) => parseTask(`${id}-${k}`, k, ev.box.raw[k]));
        chapter.boxes.push({ id, title: ev.box.title, enrichment: ev.box.enrichment, standards: ev.box.standards, tasks });
      }
    }
  });
  // A few PDF lines omit the book ("pg. 21 (#82-87)"): inherit it from a sibling task, else the previous one.
  let lastBook = null;
  for (const b of chapters.flatMap((c) => c.boxes)) {
    const own = b.tasks.find((t) => t.book)?.book ?? lastBook;
    for (const t of b.tasks) if (t.pages && !t.book && own) t.book = own;
    if (own) lastBook = own;
  }
  for (const c of chapters) addExtraPractice(level, c); // problems the PDF skips become extra boxes
  return { level: Number(level), source: file.split('/').pop(), chapters };
}

if (process.argv[1] && process.argv[1].endsWith('import-plan.mjs')) {
  const [, , pdf, level, out] = process.argv;
  const data = await importPlan(pdf, level);
  fs.writeFileSync(out, JSON.stringify(data, null, 1));
  const boxes = data.chapters.flatMap((c) => c.boxes);
  console.log(`Level ${level}: ${data.chapters.length} chapters, ${boxes.length} boxes (${boxes.filter((b) => b.extra).length} extra), ${boxes.flatMap((b) => b.tasks).length} tasks -> ${out}`);
}
