import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { fetchScratch, saveScratch } from '../api';
import { newer, thin, type ScratchData, type Stroke } from '../../netlify/functions/_scratch';

const COLORS = [
  { c: '#1e2a3a', name: 'Navy' },
  { c: '#d13b3b', name: 'Red' },
  { c: '#2955a5', name: 'Blue' },
];
const WIDTHS = [{ w: 2.2, name: 'Thin' }, { w: 4.5, name: 'Thick' }];
const SAVE_DELAY = 1500;
const KEEPALIVE_LIMIT = 60_000; // browsers refuse keepalive bodies over 64 KB; the local copy covers bigger pages
const MAX_Y = 4.9; // the page can grow to 4.9 page-widths tall (the server accepts up to 5)
const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
/** Lowest point of any stroke, in page-width units. */
const lowest = (strokes: Stroke[]) => strokes.reduce((m, s) => { for (let i = 1; i < s.p.length; i += 3) if (s.p[i] > m) m = s.p[i]; return m; }, 0);

const localKey = (id: string) => `ba.scratch.${id}`;
const readLocal = (id: string): ScratchData | null => {
  try {
    const raw = localStorage.getItem(localKey(id));
    return raw ? (JSON.parse(raw) as ScratchData) : null;
  } catch {
    return null;
  }
};
const writeLocal = (id: string, d: ScratchData) => {
  try {
    localStorage.setItem(localKey(id), JSON.stringify(d));
  } catch {
    /* storage full or blocked: the server copy still saves */
  }
};

/** Draws strokes onto a canvas whose CSS width is `cssW` (points are scaled to the page width). */
function paint(ctx: CanvasRenderingContext2D, strokes: Stroke[], cssW: number) {
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  for (const s of strokes) drawStroke(ctx, s, cssW, 0);
}
function drawStroke(ctx: CanvasRenderingContext2D, s: Stroke, cssW: number, from: number) {
  const p = s.p;
  ctx.strokeStyle = s.c;
  ctx.fillStyle = s.c;
  const width = (pr: number) => (s.w / 1000) * cssW * (0.55 + pr * 0.9);
  if (p.length === 3 && from === 0) {
    ctx.beginPath();
    ctx.arc(p[0] * cssW, p[1] * cssW, width(p[2]) / 2, 0, Math.PI * 2);
    ctx.fill();
    return;
  }
  for (let i = Math.max(3, from); i < p.length; i += 3) {
    ctx.beginPath();
    ctx.lineWidth = width((p[i - 1] + p[i + 2]) / 2);
    ctx.moveTo(p[i - 3] * cssW, p[i - 2] * cssW);
    ctx.lineTo(p[i] * cssW, p[i + 1] * cssW);
    ctx.stroke();
  }
}

type Action = { add: Stroke } | { erased: { i: number; s: Stroke }[] };

/**
 * A blank rough-work page for one problem. Apple Pencil draws (with pressure); once a pencil has touched
 * the page, fingers no longer draw (palm rejection). Every change is kept on the iPad at once and saved to
 * the server shortly after, and again when the page is closed or hidden. Nothing ever clears the page.
 */
export function RoughNote({ level, chapter, n, hint, onBack }: { level: number; chapter: number; n: number; hint?: string; onBack: () => void }) {
  const id = `${level}-c${chapter}-${n}`;
  const wrap = useRef<HTMLDivElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const strokes = useRef<Stroke[]>([]);
  const updatedAt = useRef(0);
  const undo = useRef<Action[]>([]);
  const [canUndo, setCanUndo] = useState(false);
  const [tool, setTool] = useState<'pen' | 'eraser'>('pen');
  const [color, setColor] = useState(COLORS[0].c);
  const [width, setWidth] = useState(WIDTHS[1].w); // thick by default (easier to read on the iPad)
  const [status, setStatus] = useState<'loading' | 'saved' | 'saving' | 'local'>('loading');
  const penSeen = useRef(false);
  const drawing = useRef<{ id: number; s: Stroke | null } | null>(null);
  const timer = useRef<number | undefined>(undefined);
  const dirty = useRef(false);
  const size = useRef({ w: 0, h: 0 }); // the visible part of the page
  // The page is taller than the screen and scrolls. The canvas only covers the visible part (a canvas the size
  // of the whole page would be too big for iPad Safari) and is redrawn shifted by the scroll position.
  const [pageH, setPageH] = useState(0);
  const [edge, setEdge] = useState({ top: true, bottom: true });
  const [showHint, setShowHint] = useState(false);
  const touches = useRef(new Map<number, number>()); // finger id -> last y, for finger scrolling
  const scrolling = useRef(false);

  const redraw = useCallback(() => {
    const cv = canvas.current;
    if (!cv) return;
    const ctx = cv.getContext('2d')!;
    const dpr = window.devicePixelRatio || 1;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, size.current.w, size.current.h);
    ctx.translate(0, -(wrap.current?.scrollTop ?? 0));
    paint(ctx, strokes.current, size.current.w);
  }, []);

  // always a blank screen of room below the lowest stroke (up to the page limit)
  const grow = useCallback(() => {
    const { w, h } = size.current;
    if (!w) return;
    setPageH(Math.round(Math.min(MAX_Y * w, Math.max(h, lowest(strokes.current) * w + h))));
  }, []);

  const onScroll = useCallback(() => {
    const el = wrap.current;
    if (!el) return;
    redraw();
    setEdge({ top: el.scrollTop <= 1, bottom: el.scrollTop + el.clientHeight >= el.scrollHeight - 1 });
  }, [redraw]);
  useLayoutEffect(onScroll, [pageH, onScroll]);

  // size the canvas to the visible page (sharp on retina)
  useLayoutEffect(() => {
    const el = wrap.current, cv = canvas.current;
    if (!el || !cv) return;
    const fit = () => {
      const w = el.clientWidth, h = el.clientHeight;
      const dpr = window.devicePixelRatio || 1;
      size.current = { w, h };
      cv.width = Math.round(w * dpr);
      cv.height = Math.round(h * dpr);
      cv.style.width = `${w}px`;
      cv.style.height = `${h}px`;
      grow();
      redraw();
    };
    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(el);
    return () => ro.disconnect();
  }, [redraw, grow]);

  const scrollBy = (dy: number) => wrap.current?.scrollBy({ top: dy, behavior: 'smooth' });

  // iPad Safari starts a text selection / magnifier on a long press unless the touch itself is cancelled.
  // (React's touch listeners are passive, so this one is added by hand.) Pointer events still fire.
  useEffect(() => {
    const cv = canvas.current;
    if (!cv) return;
    const stop = (e: Event) => e.preventDefault();
    cv.addEventListener('touchstart', stop, { passive: false });
    cv.addEventListener('touchmove', stop, { passive: false });
    document.addEventListener('selectstart', stop);
    return () => {
      cv.removeEventListener('touchstart', stop);
      cv.removeEventListener('touchmove', stop);
      document.removeEventListener('selectstart', stop);
    };
  }, []);

  const push = useCallback(
    async (keepalive = false) => {
      if (!dirty.current) return;
      const data: ScratchData = { strokes: strokes.current, updatedAt: updatedAt.current };
      const big = JSON.stringify(data).length > KEEPALIVE_LIMIT;
      setStatus('saving');
      try {
        await saveScratch(level, chapter, n, data, keepalive && !big);
        if (updatedAt.current === data.updatedAt) {
          dirty.current = false;
          setStatus('saved');
        }
      } catch {
        setStatus('local'); // kept on this device; uploaded next time
      }
    },
    [level, chapter, n],
  );

  // load: the newer of this iPad's copy and the server's copy; upload the local one if it is newer
  useEffect(() => {
    let live = true;
    const local = readLocal(id);
    fetchScratch(level, chapter, n)
      .catch(() => null)
      .then((server) => {
        if (!live) return;
        const best = newer(server && server.updatedAt ? server : null, local);
        strokes.current = best?.strokes ?? [];
        updatedAt.current = best?.updatedAt ?? 0;
        grow();
        redraw();
        if (best && best === local && (!server || local!.updatedAt > server.updatedAt)) {
          dirty.current = true;
          void push();
        } else setStatus(server ? 'saved' : 'local');
      });
    return () => {
      live = false;
    };
  }, [id, level, chapter, n, redraw, grow, push]);

  const changed = useCallback(() => {
    updatedAt.current = Math.max(Date.now(), updatedAt.current + 1);
    dirty.current = true;
    grow();
    writeLocal(id, { strokes: strokes.current, updatedAt: updatedAt.current });
    setStatus('saving');
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => void push(), SAVE_DELAY);
  }, [id, push, grow]);

  // save straight away when the page is hidden (app switch, lock) or the note is closed
  useEffect(() => {
    const onHide = () => document.visibilityState === 'hidden' && void push(true);
    document.addEventListener('visibilitychange', onHide);
    window.addEventListener('pagehide', onHide);
    return () => {
      document.removeEventListener('visibilitychange', onHide);
      window.removeEventListener('pagehide', onHide);
      window.clearTimeout(timer.current);
      void push(true);
    };
  }, [push]);

  const pos = (e: PointerEvent | React.PointerEvent) => {
    const r = canvas.current!.getBoundingClientRect();
    const w = size.current.w || 1;
    const pressure = e.pointerType === 'pen' ? e.pressure || 0.5 : 0.5;
    const top = wrap.current?.scrollTop ?? 0;
    // clamped: a point dragged off the page would make the server refuse the whole save
    return [clamp((e.clientX - r.left) / w, 0, 1), clamp((e.clientY - r.top + top) / w, 0, MAX_Y), pressure];
  };

  const eraseAt = (x: number, y: number) => {
    const rad = 14 / (size.current.w || 1);
    const gone: { i: number; s: Stroke }[] = [];
    strokes.current = strokes.current.filter((s, i) => {
      for (let k = 0; k < s.p.length; k += 3) {
        const dx = s.p[k] - x, dy = s.p[k + 1] - y;
        if (dx * dx + dy * dy <= rad * rad) {
          gone.push({ i, s });
          return false;
        }
      }
      return true;
    });
    if (gone.length) {
      undo.current.push({ erased: gone });
      setCanUndo(true);
      redraw();
      changed();
    }
  };

  const capture = (e: React.PointerEvent) => {
    try {
      canvas.current!.setPointerCapture(e.pointerId);
    } catch {
      /* not a real pointer (tests) */
    }
  };
  const down = (e: React.PointerEvent) => {
    if (e.pointerType === 'pen') penSeen.current = true;
    else if (e.pointerType === 'touch') {
      // Fingers scroll: one finger once a pencil has been used (palm rejection), otherwise two fingers.
      touches.current.set(e.pointerId, e.clientY);
      if (penSeen.current || touches.current.size >= 2) {
        e.preventDefault();
        capture(e);
        const d = drawing.current;
        if (d && d.s && d.id !== e.pointerId) {
          drawing.current = null; // the first finger had started a line: it was the start of a scroll
          redraw();
        }
        scrolling.current = true;
        return;
      }
    }
    if (drawing.current) return;
    e.preventDefault();
    capture(e);
    const [x, y, pr] = pos(e);
    if (tool === 'eraser') {
      drawing.current = { id: e.pointerId, s: null };
      eraseAt(x, y);
      return;
    }
    const s: Stroke = { c: color, w: width, p: [x, y, pr] };
    drawing.current = { id: e.pointerId, s };
    const ctx = canvas.current!.getContext('2d')!;
    ctx.lineCap = 'round';
    drawStroke(ctx, s, size.current.w, 0);
  };
  const move = (e: React.PointerEvent) => {
    const t = touches.current;
    if (scrolling.current && t.has(e.pointerId)) {
      const dy = e.clientY - t.get(e.pointerId)!;
      t.set(e.pointerId, e.clientY);
      if (wrap.current) wrap.current.scrollTop -= dy / t.size;
      return;
    }
    if (t.has(e.pointerId)) t.set(e.pointerId, e.clientY);
    const d = drawing.current;
    if (!d || d.id !== e.pointerId) return;
    const events = (e.nativeEvent as PointerEvent).getCoalescedEvents?.() ?? [e.nativeEvent];
    for (const ev of events.length ? events : [e.nativeEvent]) {
      const [x, y, pr] = pos(ev);
      if (!d.s) {
        eraseAt(x, y);
        continue;
      }
      const from = d.s.p.length;
      d.s.p.push(x, y, pr);
      const ctx = canvas.current!.getContext('2d')!;
      ctx.lineCap = 'round';
      drawStroke(ctx, d.s, size.current.w, from);
    }
  };
  const up = (e: React.PointerEvent) => {
    if (touches.current.delete(e.pointerId) && touches.current.size === 0) scrolling.current = false;
    const d = drawing.current;
    if (!d || d.id !== e.pointerId) return;
    drawing.current = null;
    if (!d.s) return;
    const s = { ...d.s, p: thin(d.s.p) };
    strokes.current = [...strokes.current, s];
    undo.current.push({ add: s });
    setCanUndo(true);
    redraw();
    changed();
  };

  const doUndo = () => {
    const a = undo.current.pop();
    if (!a) return;
    if ('add' in a) strokes.current = strokes.current.filter((s) => s !== a.add);
    else {
      const next = [...strokes.current];
      for (const { i, s } of [...a.erased].reverse()) next.splice(Math.min(i, next.length), 0, s);
      strokes.current = next;
    }
    setCanUndo(undo.current.length > 0);
    redraw();
    changed();
  };

  return (
    <div className="rough">
      <div className="rough-bar">
        <button type="button" className="rough-back" onClick={onBack}>↩ Question</button>
        <div className="rough-tools" role="toolbar" aria-label="Rough note tools">
          <button type="button" className={`rt${tool === 'pen' ? ' on' : ''}`} aria-pressed={tool === 'pen'} onClick={() => setTool('pen')}>✏️ Pen</button>
          <button type="button" className={`rt${tool === 'eraser' ? ' on' : ''}`} aria-pressed={tool === 'eraser'} onClick={() => setTool('eraser')}>🧽 Eraser</button>
          <button type="button" className="rt" disabled={!canUndo} onClick={doUndo}>↶ Undo</button>
          <span className="rt-sep" />
          {COLORS.map((k) => (
            <button key={k.c} type="button" className={`rt-color${color === k.c && tool === 'pen' ? ' on' : ''}`} style={{ background: k.c }} aria-label={`${k.name} ink`} aria-pressed={color === k.c} onClick={() => { setColor(k.c); setTool('pen'); }} />
          ))}
          {WIDTHS.map((k) => (
            <button key={k.w} type="button" className={`rt-width${width === k.w && tool === 'pen' ? ' on' : ''}`} aria-label={`${k.name} line`} aria-pressed={width === k.w} onClick={() => { setWidth(k.w); setTool('pen'); }}>
              <span style={{ height: k.w * 1.6 }} />
            </button>
          ))}
        </div>
        <span className={`rough-status rs-${status}`} aria-live="polite">
          {status === 'saved' ? 'Saved ✓' : status === 'saving' ? 'Saving…' : status === 'local' ? 'Saved on this device' : 'Loading…'}
        </span>
        {hint && (
          <button type="button" className={`rt rough-hint-btn${showHint ? ' on' : ''}`} aria-expanded={showHint} onClick={() => setShowHint((v) => !v)}>💡 Hint</button>
        )}
      </div>
      <div className="rough-area">
        <div className="rough-page" ref={wrap} onScroll={onScroll}>
          <canvas
            ref={canvas}
            className={tool === 'eraser' ? 'erasing' : ''}
            onPointerDown={down}
            onPointerMove={move}
            onPointerUp={up}
            onPointerCancel={up}
            aria-label="Rough note page. Draw here."
          />
          <div className="rough-spacer" style={{ height: Math.max(0, pageH - size.current.h) }} />
        </div>
        <div className="rough-scroll">
          <button type="button" aria-label="Scroll up" disabled={edge.top} onClick={() => scrollBy(-size.current.h * 0.8)}>▲</button>
          <button type="button" aria-label="More paper below" disabled={edge.bottom} onClick={() => scrollBy(size.current.h * 0.8)}>▼</button>
        </div>
        {hint && showHint && (
          <button type="button" className="rough-hint" onClick={() => setShowHint(false)} aria-label="Hint. Tap to close.">
            <b>💡 Hint</b> {hint}
          </button>
        )}
      </div>
    </div>
  );
}

/** A small read-only picture of a problem's rough page (for the solved-problem review). */
export function RoughThumb({ level, chapter, n }: { level: number; chapter: number; n: number }) {
  const cv = useRef<HTMLCanvasElement>(null);
  const [has, setHas] = useState(false);
  useEffect(() => {
    let live = true;
    const local = readLocal(`${level}-c${chapter}-${n}`);
    fetchScratch(level, chapter, n)
      .catch(() => null)
      .then((server) => {
        const best = newer(server && server.updatedAt ? server : null, local);
        if (!live || !best?.strokes.length || !cv.current) return;
        setHas(true);
        const maxY = Math.max(0.4, lowest(best.strokes)) + 0.03;
        const W = Math.round(360 * Math.min(1, 480 / (360 * maxY))); // a tall page is shrunk to fit, not cut off
        const H = Math.round(W * maxY);
        const dpr = window.devicePixelRatio || 1;
        cv.current.width = W * dpr;
        cv.current.height = H * dpr;
        cv.current.style.width = `${W}px`;
        cv.current.style.height = `${H}px`;
        const ctx = cv.current.getContext('2d')!;
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        paint(ctx, best.strokes, W);
      });
    return () => {
      live = false;
    };
  }, [level, chapter, n]);
  return (
    <div className={has ? 'rough-thumb-wrap' : 'rough-thumb none'}>
      {has && <h4>Rough work</h4>}
      <div className={`rough-thumb${has ? '' : ' none'}`}>
        <canvas ref={cv} />
      </div>
    </div>
  );
}
