const DIGITS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '0'];
const NAMES: Record<string, string> = { ',': 'comma', '×': 'times', '^': 'to the power', '÷': 'divided by', '=': 'equals', '&': 'and', '/': 'fraction bar', '.': 'decimal point', '−': 'minus', '⌫': 'Erase' };

/**
 * Big on-screen keys, like Beast Academy Online: digits, then any symbol keys the answer needs, then erase.
 * Used instead of the iPad keyboard for number answers, and by the times-table puzzle.
 */
export function NumberPad({ keys = [], disabled, onKey }: { keys?: string[]; disabled?: boolean; onKey: (k: string) => void }) {
  return (
    <div className="numpad digits" role="group" aria-label="Number pad">
      {[...DIGITS, ...keys, '⌫'].map((k) => (
        <button
          key={k}
          type="button"
          className={`numkey${k === '⌫' ? ' erase' : DIGITS.includes(k) ? '' : ' sym'}`}
          disabled={disabled}
          // keep the focus (and the caret) in the answer box
          onPointerDown={(e) => e.preventDefault()}
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => onKey(k)}
          aria-label={NAMES[k] ?? k}
        >
          {k}
        </button>
      ))}
    </div>
  );
}
