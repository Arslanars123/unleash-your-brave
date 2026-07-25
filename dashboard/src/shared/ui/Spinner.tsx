interface SpinnerProps {
  label?: string;
}

export function Spinner({ label = 'Loading…' }: SpinnerProps) {
  return (
    <div className="spinner" role="status" aria-live="polite">
      <span className="spinner-dot" />
      <span>{label}</span>
    </div>
  );
}
