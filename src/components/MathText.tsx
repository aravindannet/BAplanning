import { Fragment } from 'react';

/** One number drawn the book's way: "2 3/4" as a whole number beside a stacked fraction. */
export function Frac({ v }: { v: string }) {
  const m = v.trim().match(/^(?:(\d+)\s+)?(\d+)\/(\d+)$/);
  if (!m) return <>{v}</>;
  return (
    <span className="mt-num" data-text={v.trim()} aria-label={m[1] ? `${m[1]} and ${m[2]} over ${m[3]}` : `${m[2]} over ${m[3]}`}>
      {m[1] && <span className="mt-whole">{m[1]}</span>}
      <span className="mt-frac" aria-hidden="true">
        <span className="mt-top">{m[2]}</span>
        <span className="mt-bot">{m[3]}</span>
      </span>
    </span>
  );
}

/** Copy handler: stacked fractions in the selection are copied as plain text ("2 3/4"), not as "234". */
export function copyPlainFractions(e: React.ClipboardEvent) {
  const sel = window.getSelection();
  if (!sel || sel.isCollapsed || !sel.rangeCount) return;
  const box = document.createElement('div');
  for (let i = 0; i < sel.rangeCount; i++) box.appendChild(sel.getRangeAt(i).cloneContents());
  const nums = box.querySelectorAll<HTMLElement>('.mt-num[data-text]');
  if (!nums.length) return;
  nums.forEach((el) => el.replaceWith(` ${el.dataset.text} `));
  e.clipboardData.setData('text/plain', (box.textContent ?? '').replace(/[ \t]+/g, ' ').replace(/ ?\n ?/g, '\n').trim());
  e.preventDefault();
}

// a mixed number ("2 3/4") or a fraction ("3/4"); not part of a longer number or a date
const NUM = /(?<![\d/])(?:(\d+)\s+)?(\d+)\/(\d+)(?![\d/])/g;

/** Text with every fraction and mixed number drawn stacked, so "1 3/7" reads like the book. */
export function MathText({ text }: { text: string }) {
  const out: React.ReactNode[] = [];
  let last = 0;
  for (const m of text.matchAll(NUM)) {
    const at = m.index ?? 0;
    if (at > last) out.push(text.slice(last, at));
    out.push(<Frac key={at} v={m[0]} />);
    last = at + m[0].length;
  }
  if (!out.length) return <>{text}</>;
  if (last < text.length) out.push(text.slice(last));
  return <>{out.map((x, i) => <Fragment key={i}>{x}</Fragment>)}</>;
}
