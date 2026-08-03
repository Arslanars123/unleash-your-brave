import type { TextareaHTMLAttributes } from 'react';
import { cn } from '@/shared/lib/cn';

interface TextAreaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label: string;
  error?: string;
  requiredMark?: boolean;
}

export function TextArea({
  label,
  error,
  requiredMark = false,
  className,
  id,
  ...props
}: TextAreaProps) {
  const inputId = id ?? props.name ?? label.toLowerCase().replace(/\s+/g, '-');

  return (
    <label className="field" htmlFor={inputId}>
      <span className="field-label">
        {label}
        {requiredMark ? <span className="required-mark"> *</span> : null}
      </span>
      <textarea
        id={inputId}
        className={cn('field-input field-textarea', error && 'field-input-error', className)}
        rows={4}
        {...props}
      />
      {error ? <span className="field-error">{error}</span> : null}
    </label>
  );
}
