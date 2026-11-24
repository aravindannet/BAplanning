// Turns the PDF's cryptic task text into structured, kid-readable fields.
//   Guide:    "4A pg. 14-18 (R&G)"                      -> book 4A, pages [14..18], topic "R&G"
//   Practice: "4A pg. 11, 13 (#27-36 and #43-46, with #33-36 optional)"
//                                                       -> pages [11,13], problems 27-36,43-46 (33-36 optional)
//   Online:   "Angle Sense, Using a Protractor"          -> text only
// Anything that does not match is kept verbatim in `raw` and shown as-is, never guessed at.

function expandRange(a, b) {
  const out = [];
  for (let i = a; i <= b; i++) out.push(i);
  return out;
}

export function parsePageList(s) {
  const out = [];
  for (const part of s.split(/\s*(?:,|&|\band\b)\s*/)) {
    const m = part.trim().match(/^(\d+)\s*[-–]\s*(\d+)$/);
    if (m) out.push(...expandRange(+m[1], +m[2]));
    else if (/^\d+$/.test(part.trim())) out.push(+part.trim());
  }
  return out;
}

function hashNumbers(s) {
  const out = [];
  for (const m of s.matchAll(/#\s*(\d+)(?:\s*[-–]\s*(\d+))?/g)) {
    out.push(...(m[2] ? expandRange(+m[1], +m[2]) : [+m[1]]));
  }
  return out;
}

export function parseProblems(s) {
  // "with #33-36 optional" -> optional set; everything else is required. Tolerates the PDF's typos
  // such as a missing "(" ("9#81-92, with #86 optional)").
  const optional = new Set();
  const main = s.replace(/with\s+(.*?)\s+optional/gi, (_, o) => {
    hashNumbers(o).forEach((n) => optional.add(n));
    return '';
  });
  const all = [...new Set(hashNumbers(main).concat([...optional]))].sort((a, b) => a - b);
  return all.map((n) => ({ n, optional: optional.has(n) }));
}

export function parseTask(id, type, raw) {
  const task = { id, type, raw };
  if (type === 'online') {
    task.text = raw;
    return task;
  }
  const m = raw.match(/^(?:(\d[A-Z])\s+)?pg\.?\s*((?:\d+(?!\d*#)|[\s,&\u2013-]|\band\b)+)([\s\S]*)$/);
  if (!m) {
    task.text = raw;
    return task;
  }
  if (m[1]) task.book = m[1];
  task.pages = parsePageList(m[2]);
  const rest = m[3].replace(/^[\s(9]+/, (x) => x.replace(/9/g, '')).trim();
  if (type === 'guide') {
    if (rest) task.topic = rest.replace(/^\(/, '').replace(/\)$/, '').trim();
  } else {
    task.problems = parseProblems(rest);
  }
  if (!task.pages.length) {
    delete task.pages;
    task.text = raw;
  }
  return task;
}
