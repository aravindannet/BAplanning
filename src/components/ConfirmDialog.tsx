import { useState } from 'react';

interface Props {
  title: string;
  body: string;
  confirmLabel: string;
  danger?: boolean;
  passcode?: boolean; // ask for the parent passcode
  error?: string | null;
  busy?: boolean;
  onConfirm: (passcode: string) => void;
  onCancel: () => void;
}

export function ConfirmDialog({ title, body, confirmLabel, danger, passcode, error, busy, onConfirm, onCancel }: Props) {
  const [code, setCode] = useState('');
  const submit = () => {
    if (!busy && (!passcode || code)) onConfirm(code);
  };
  return (
    <div className="overlay" onClick={onCancel} role="alertdialog" aria-modal="true" aria-label={title}>
      <form className="dialog confirm" onClick={(e) => e.stopPropagation()} onSubmit={(e) => { e.preventDefault(); submit(); }}>
        <h2>{title}</h2>
        <p className="what">{body}</p>
        {passcode && (
          <>
            <input
              className="passcode"
              type="password"
              inputMode="numeric"
              autoComplete="off"
              autoFocus
              placeholder="Parent passcode"
              aria-label="Parent passcode"
              value={code}
              onChange={(e) => setCode(e.target.value)}
            />
            {error && <div className="problem-msg" role="alert">{error}</div>}
          </>
        )}
        <button className={`bn primary${danger ? ' danger' : ''}`} type="submit" autoFocus={!passcode} disabled={busy || (passcode && !code)}>{confirmLabel}</button>
        <button className="link" type="button" onClick={onCancel}>Cancel</button>
      </form>
    </div>
  );
}
