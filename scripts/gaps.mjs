// The official sequence sometimes skips problem numbers (e.g. Level 4 Counting jumps from #90 to #98).
// Those problems still exist in the workbook, so each run of missing numbers becomes an extra
// "Extra practice" box, placed right after the box that holds the problem before the gap.
// Existing box ids are never renumbered (extras use `x<k>` ids), so saved progress stays valid.

const practiceOf = (box) => box.tasks.find((t) => t.type === 'practice' && t.problems?.length);

function runs(numbers) {
  const sorted = [...new Set(numbers)].sort((a, b) => a - b);
  const out = [];
  for (let i = 1; i < sorted.length; i++) {
    if (sorted[i] - sorted[i - 1] > 1) out.push([sorted[i - 1] + 1, sorted[i] - 1]);
  }
  return out;
}

const range = (a, b) => Array.from({ length: b - a + 1 }, (_, i) => a + i);

/** Mutates and returns the chapter, with extra boxes inserted. */
export function addExtraPractice(level, chapter) {
  const all = chapter.boxes.flatMap((b) => practiceOf(b)?.problems.map((p) => p.n) ?? []);
  const gaps = runs(all);
  const inserts = []; // { at: index to insert at, box }
  gaps.forEach(([a, b], k) => {
    // lower anchor = the last box (in plan order) that contains problem a-1; upper = first with b+1
    let lo = -1;
    let hi = -1;
    chapter.boxes.forEach((box, i) => {
      const nums = practiceOf(box)?.problems.map((p) => p.n) ?? [];
      if (nums.includes(a - 1)) lo = i;
      if (hi === -1 && nums.includes(b + 1)) hi = i;
    });
    const at = lo !== -1 ? lo + 1 : hi !== -1 ? hi : chapter.boxes.length;
    const loTask = lo !== -1 ? practiceOf(chapter.boxes[lo]) : null;
    const hiTask = hi !== -1 ? practiceOf(chapter.boxes[hi]) : null;
    const id = `${level}-c${chapter.number}-x${k + 1}`;
    const task = { id: `${id}-practice`, type: 'practice', raw: `extra: problems ${a}-${b}`, problems: range(a, b).map((n) => ({ n, optional: false })) };
    // Infer the workbook pages only when both neighbours name pages in the same book with room between.
    if (loTask?.pages?.length && hiTask?.pages?.length && loTask.book && loTask.book === hiTask.book) {
      const from = Math.max(...loTask.pages) + 1;
      const to = Math.min(...hiTask.pages) - 1;
      if (from <= to) {
        task.book = loTask.book;
        task.pages = range(from, to);
      }
    }
    inserts.push({ at, box: { id, title: 'Extra practice', enrichment: false, extra: true, standards: [], tasks: [task] } });
  });
  // apply from the back so earlier indexes stay valid; keep numeric order for equal positions
  inserts.sort((x, y) => y.at - x.at || y.box.id.localeCompare(x.box.id));
  for (const { at, box } of inserts) chapter.boxes.splice(at, 0, box);
  return chapter;
}
