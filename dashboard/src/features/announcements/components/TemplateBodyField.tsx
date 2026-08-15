import { useRef } from 'react';
import { TextArea } from '@/shared/ui/TextArea';

/** Human-readable labels shown in the editor; stored as {{tokens}} for the API. */
export const TEMPLATE_FIELDS = [
  { token: 'daysLeft', label: 'Days Left' },
  { token: 'eventName', label: 'Event Name' },
  { token: 'eventDate', label: 'Event Date' },
] as const;

export function templateToDisplay(raw: string): string {
  let out = raw;
  for (const field of TEMPLATE_FIELDS) {
    out = out.replaceAll(`{{${field.token}}}`, field.label);
  }
  return out;
}

export function displayToTemplate(display: string): string {
  let out = display;
  // Replace longer labels first to avoid partial overlaps.
  const sorted = [...TEMPLATE_FIELDS].sort((a, b) => b.label.length - a.label.length);
  for (const field of sorted) {
    out = out.replaceAll(field.label, `{{${field.token}}}`);
  }
  return out;
}

interface TemplateBodyFieldProps {
  label: string;
  value: string;
  onChange: (templateValue: string) => void;
  rows?: number;
}

/**
 * Announcement body editor: insert readable field names (no {{brackets}}).
 * Values are converted to {{tokens}} when calling onChange.
 */
export function TemplateBodyField({
  label,
  value,
  onChange,
  rows = 4,
}: TemplateBodyFieldProps) {
  const ref = useRef<HTMLTextAreaElement>(null);
  const display = templateToDisplay(value);

  function insertField(fieldLabel: string) {
    const el = ref.current;
    if (!el) {
      onChange(displayToTemplate(`${display}${display ? ' ' : ''}${fieldLabel}`));
      return;
    }
    const start = el.selectionStart ?? display.length;
    const end = el.selectionEnd ?? display.length;
    const next = `${display.slice(0, start)}${fieldLabel}${display.slice(end)}`;
    onChange(displayToTemplate(next));
    requestAnimationFrame(() => {
      el.focus();
      const caret = start + fieldLabel.length;
      el.setSelectionRange(caret, caret);
    });
  }

  return (
    <div className="field template-body-field">
      <span className="field-label">{label}</span>
      <div className="template-token-bar">
        <span className="muted" style={{ fontSize: '0.8rem', marginRight: 4 }}>
          Insert:
        </span>
        {TEMPLATE_FIELDS.map((field) => (
          <button
            key={field.token}
            type="button"
            className="template-token-chip"
            onClick={() => insertField(field.label)}
          >
            {field.label}
          </button>
        ))}
      </div>
      <TextArea
        ref={ref}
        label={undefined}
        value={display}
        rows={rows}
        onChange={(e) => onChange(displayToTemplate(e.target.value))}
        placeholder="Only Days Left days left until Event Name. We can’t wait to see you!"
      />
      <p className="hint">
        Use the buttons to insert fields. You’ll see readable names like “Days Left” — never
        {' '}
        {'{{brackets}}'}
        .
      </p>
    </div>
  );
}
