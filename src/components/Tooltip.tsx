import { useEffect, useRef, useState } from 'react';

interface Tip {
  text: string;
  x: number; // bubble centre
  y: number; // anchor edge (top of the element, or its bottom when below)
  ax: number; // arrow offset from the bubble centre
  below: boolean;
}

/**
 * One themed speech-bubble tooltip for the whole app. Any element with a `data-tip="…"` attribute gets it
 * on hover, keyboard focus, or tap (touch screens have no hover, so a tap shows it for a moment).
 * It is drawn above everything, so cards that clip their content can't cut it off.
 */
export function Tooltip() {
  const [tip, setTip] = useState<Tip | null>(null);
  const timer = useRef<number | undefined>(undefined);

  useEffect(() => {
    const show = (el: Element, hideAfter?: number) => {
      const text = el.getAttribute('data-tip');
      if (!text) return;
      const r = el.getBoundingClientRect();
      const half = 125;
      const cx = r.left + r.width / 2;
      const x = Math.min(Math.max(cx, half + 8), window.innerWidth - half - 8);
      const below = r.top < 70;
      setTip({ text, x, y: below ? r.bottom : r.top, ax: Math.max(-half + 22, Math.min(half - 22, cx - x)), below });
      window.clearTimeout(timer.current);
      if (hideAfter) timer.current = window.setTimeout(() => setTip(null), hideAfter);
    };
    const hide = () => {
      window.clearTimeout(timer.current);
      setTip(null);
    };
    const target = (e: Event) => (e.target instanceof Element ? e.target.closest('[data-tip]') : null);
    const over = (e: PointerEvent) => {
      if (e.pointerType === 'touch') return;
      const el = target(e);
      if (el) show(el);
      else hide();
    };
    const down = (e: PointerEvent) => {
      const el = target(e);
      if (el && e.pointerType === 'touch') show(el, 2200);
      else if (!el) hide();
    };
    const focus = (e: FocusEvent) => {
      const el = target(e);
      if (el) show(el);
    };
    document.addEventListener('pointerover', over);
    document.addEventListener('pointerdown', down);
    document.addEventListener('focusin', focus);
    document.addEventListener('focusout', hide);
    window.addEventListener('scroll', hide, true);
    window.addEventListener('resize', hide);
    return () => {
      document.removeEventListener('pointerover', over);
      document.removeEventListener('pointerdown', down);
      document.removeEventListener('focusin', focus);
      document.removeEventListener('focusout', hide);
      window.removeEventListener('scroll', hide, true);
      window.removeEventListener('resize', hide);
      window.clearTimeout(timer.current);
    };
  }, []);

  if (!tip) return null;
  return (
    <div className={`tip${tip.below ? ' below' : ''}`} role="tooltip" style={{ left: tip.x, top: tip.y, ['--ax' as string]: `${tip.ax}px` }}>
      {tip.text}
    </div>
  );
}
