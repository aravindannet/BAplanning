import { useEffect, useRef, useState } from 'react';

/** A themed dropdown (instead of the browser's native one): big rounded options, navy outline, gold highlight. */
export function ChoicePicker({ label, value, choices, onChange }: { label: string; value: string; choices: string[]; onChange: (v: string) => void }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const close = (e: PointerEvent) => !ref.current?.contains(e.target as Node) && setOpen(false);
    const esc = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('pointerdown', close);
    document.addEventListener('keydown', esc);
    return () => {
      document.removeEventListener('pointerdown', close);
      document.removeEventListener('keydown', esc);
    };
  }, [open]);
  return (
    <div className={`chooser${open ? ' open' : ''}`} ref={ref}>
      <button type="button" className={`picker-btn${value ? '' : ' empty'}`} aria-haspopup="listbox" aria-expanded={open} aria-label={label} onClick={() => setOpen((o) => !o)}>
        <span>{value || 'Choose…'}</span>
        <span className="picker-caret" aria-hidden="true">▾</span>
      </button>
      {open && (
        <ul className="picker-list" role="listbox" aria-label={label}>
          {choices.map((c) => (
            <li key={c}>
              <button type="button" role="option" aria-selected={c === value} className={`picker-opt${c === value ? ' on' : ''}`} onClick={() => { onChange(c); setOpen(false); }}>
                {c}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
