import type { InputHTMLAttributes } from 'react';
import { cn } from '@/shared/lib/cn';

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label: string;
  error?: string;
}

export function Input({ label, error, className, id, ...props }: InputProps) {
  const inputId = id ?? props.name ?? label.toLowerCase().replace(/\s+/g, '-');

  return (
    <label className="field" htmlFor={inputId}>
      <span className="field-label">{label}</span>
      <input id={inputId} className={cn('field-input', error && 'field-input-error', className)} {...props} />
      {error ? <span className="field-error">{error}</span> : null}
    </label>
  );
}
