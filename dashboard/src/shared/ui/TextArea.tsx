import { forwardRef, type TextareaHTMLAttributes } from 'react';
import { cn } from '@/shared/lib/cn';

interface TextAreaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  error?: string;
  requiredMark?: boolean;
}

export const TextArea = forwardRef<HTMLTextAreaElement, TextAreaProps>(
  function TextArea({ label, error, requiredMark = false, className, id, ...props }, ref) {
    const inputId = id ?? props.name ?? (label ? label.toLowerCase().replace(/\s+/g, '-') : undefined);

    const textarea = (
      <textarea
        ref={ref}
        id={inputId}
        className={cn('field-input field-textarea', error && 'field-input-error', className)}
        rows={4}
        {...props}
      />
    );

    if (!label) {
      return (
        <>
          {textarea}
          {error ? <span className="field-error">{error}</span> : null}
        </>
      );
    }

    return (
      <label className="field" htmlFor={inputId}>
        <span className="field-label">
          {label}
          {requiredMark ? <span className="required-mark"> *</span> : null}
        </span>
        {textarea}
        {error ? <span className="field-error">{error}</span> : null}
      </label>
    );
  },
);
