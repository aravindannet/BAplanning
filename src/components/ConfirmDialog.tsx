interface Props {
  title: string;
  body: string;
  confirmLabel: string;
  danger?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmDialog({ title, body, confirmLabel, danger, onConfirm, onCancel }: Props) {
  return (
    <div className="overlay" onClick={onCancel} role="alertdialog" aria-modal="true" aria-label={title}>
      <div className="dialog confirm" onClick={(e) => e.stopPropagation()}>
        <h2>{title}</h2>
        <p className="what">{body}</p>
        <button className={`primary${danger ? ' danger' : ''}`} autoFocus onClick={onConfirm}>{confirmLabel}</button>
        <button className="link" onClick={onCancel}>Cancel</button>
      </div>
    </div>
  );
}
