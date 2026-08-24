import { useEffect, useRef, useState, type FormEvent, type PointerEvent } from 'react';
import { X } from 'lucide-react';
import type { CheckInFormField, PublicCheckInForm } from '@/shared/types/api';
import { Button } from '@/shared/ui/Button';
import { Input } from '@/shared/ui/Input';
import { TextArea } from '@/shared/ui/TextArea';

export interface CheckInFormGateValues {
  answers: Record<string, string | boolean>;
  signatureDataUrl: string;
  signedName: string;
}

interface CheckInFormGateModalProps {
  open: boolean;
  form: PublicCheckInForm;
  attendeeName: string;
  loading?: boolean;
  onClose: () => void;
  onSubmit: (values: CheckInFormGateValues) => Promise<void> | void;
}

function defaultAnswers(fields: CheckInFormField[]): Record<string, string | boolean> {
  const answers: Record<string, string | boolean> = {};
  for (const field of fields) {
    if (field.type === 'checkbox') answers[field.id] = false;
    else if (field.type === 'yes_no') answers[field.id] = '';
    else answers[field.id] = '';
  }
  return answers;
}

export function CheckInFormGateModal({
  open,
  form,
  attendeeName,
  loading = false,
  onClose,
  onSubmit,
}: CheckInFormGateModalProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawing = useRef(false);
  const [answers, setAnswers] = useState<Record<string, string | boolean>>({});
  const [signedName, setSignedName] = useState('');
  const [hasStroke, setHasStroke] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fields = [...(form.fields ?? [])].sort((a, b) => a.sortOrder - b.sortOrder);

  useEffect(() => {
    if (!open) return;
    setAnswers(defaultAnswers(fields));
    setSignedName(attendeeName || '');
    setHasStroke(false);
    setError(null);
    const canvas = canvasRef.current;
    if (canvas) {
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.strokeStyle = '#111';
        ctx.lineWidth = 2;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
      }
    }
    // Reset when the modal opens for a given form / attendee
  }, [open, form.id, attendeeName]);

  if (!open) return null;

  function pointerPos(e: PointerEvent<HTMLCanvasElement>) {
    const canvas = canvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    return {
      x: (e.clientX - rect.left) * scaleX,
      y: (e.clientY - rect.top) * scaleY,
    };
  }

  function onPointerDown(e: PointerEvent<HTMLCanvasElement>) {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;
    drawing.current = true;
    canvas.setPointerCapture(e.pointerId);
    const { x, y } = pointerPos(e);
    ctx.beginPath();
    ctx.moveTo(x, y);
  }

  function onPointerMove(e: PointerEvent<HTMLCanvasElement>) {
    if (!drawing.current) return;
    const ctx = canvasRef.current?.getContext('2d');
    if (!ctx) return;
    const { x, y } = pointerPos(e);
    ctx.lineTo(x, y);
    ctx.stroke();
    setHasStroke(true);
  }

  function onPointerUp(e: PointerEvent<HTMLCanvasElement>) {
    drawing.current = false;
    canvasRef.current?.releasePointerCapture(e.pointerId);
  }

  function clearSignature() {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    setHasStroke(false);
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);

    for (const field of fields) {
      if (!field.required) continue;
      const value = answers[field.id];
      if (field.type === 'checkbox') {
        if (value !== true) {
          setError(`“${field.label}” is required`);
          return;
        }
      } else if (value === undefined || value === null || String(value).trim() === '') {
        setError(`“${field.label}” is required`);
        return;
      }
    }

    if (!signedName.trim()) {
      setError('Signed name is required');
      return;
    }

    if (form.requireSignature && !hasStroke) {
      setError('Signature is required');
      return;
    }

    const signatureDataUrl =
      form.requireSignature && canvasRef.current && hasStroke
        ? canvasRef.current.toDataURL('image/png')
        : '';

    await onSubmit({
      answers,
      signatureDataUrl,
      signedName: signedName.trim(),
    });
  }

  return (
    <div className="modal-backdrop" role="presentation" onClick={onClose}>
      <div
        className="modal-panel"
        role="dialog"
        aria-modal="true"
        aria-labelledby="checkin-form-gate-title"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="modal-header">
          <h2 id="checkin-form-gate-title">{form.title || 'Complete check-in form'}</h2>
          <button type="button" className="modal-close" onClick={onClose} aria-label="Close">
            <X size={18} />
          </button>
        </header>

        <form className="modal-body event-form" onSubmit={(e) => void handleSubmit(e)} noValidate>
          {form.description ? <p className="muted">{form.description}</p> : null}
          <p className="hint" style={{ marginTop: 0 }}>
            Completing check-in for <strong>{attendeeName}</strong>
          </p>

          {fields.map((field) => {
            if (field.type === 'textarea') {
              return (
                <TextArea
                  key={field.id}
                  label={field.label}
                  requiredMark={field.required}
                  value={String(answers[field.id] ?? '')}
                  disabled={loading}
                  onChange={(e) =>
                    setAnswers((prev) => ({ ...prev, [field.id]: e.target.value }))
                  }
                />
              );
            }
            if (field.type === 'checkbox') {
              return (
                <label key={field.id} className="checkbox-row">
                  <input
                    type="checkbox"
                    checked={Boolean(answers[field.id])}
                    disabled={loading}
                    onChange={(e) =>
                      setAnswers((prev) => ({ ...prev, [field.id]: e.target.checked }))
                    }
                  />
                  <span>
                    {field.label}
                    {field.required ? ' *' : ''}
                  </span>
                </label>
              );
            }
            if (field.type === 'yes_no') {
              return (
                <label key={field.id} className="field">
                  <span className="field-label">
                    {field.label}
                    {field.required ? ' *' : ''}
                  </span>
                  <select
                    className="field-input"
                    value={String(answers[field.id] ?? '')}
                    disabled={loading}
                    onChange={(e) =>
                      setAnswers((prev) => ({ ...prev, [field.id]: e.target.value }))
                    }
                  >
                    <option value="">Select…</option>
                    <option value="yes">Yes</option>
                    <option value="no">No</option>
                  </select>
                </label>
              );
            }
            return (
              <Input
                key={field.id}
                label={field.label}
                requiredMark={field.required}
                value={String(answers[field.id] ?? '')}
                disabled={loading}
                onChange={(e) =>
                  setAnswers((prev) => ({ ...prev, [field.id]: e.target.value }))
                }
              />
            );
          })}

          <Input
            label="Signed name"
            requiredMark
            value={signedName}
            disabled={loading}
            onChange={(e) => setSignedName(e.target.value)}
            placeholder="Full legal name"
          />

          {form.requireSignature ? (
            <div className="field">
              <span className="field-label">
                Signature{form.requireSignature ? ' *' : ''}
              </span>
              <canvas
                ref={canvasRef}
                width={560}
                height={180}
                className="checkin-signature-pad"
                style={{
                  width: '100%',
                  height: 160,
                  touchAction: 'none',
                  border: '1px solid var(--border, #ccc)',
                  borderRadius: 8,
                  background: '#fff',
                  cursor: 'crosshair',
                }}
                onPointerDown={onPointerDown}
                onPointerMove={onPointerMove}
                onPointerUp={onPointerUp}
                onPointerLeave={onPointerUp}
              />
              <div style={{ marginTop: 8 }}>
                <Button type="button" variant="ghost" disabled={loading} onClick={clearSignature}>
                  Clear signature
                </Button>
              </div>
            </div>
          ) : null}

          {error ? <p className="form-error">{error}</p> : null}

          <div className="modal-actions">
            <Button type="button" variant="secondary" onClick={onClose} disabled={loading}>
              Cancel
            </Button>
            <Button type="submit" loading={loading}>
              Submit & check in
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
