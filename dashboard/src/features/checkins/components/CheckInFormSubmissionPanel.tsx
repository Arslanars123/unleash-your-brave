import type {
  CheckInFormField,
  PublicCheckInForm,
  PublicCheckInFormSubmission,
} from '@/shared/types/api';
import { formatUsDateTime } from '@/shared/lib/datetime';

interface CheckInFormSubmissionPanelProps {
  form: PublicCheckInForm | null | undefined;
  submission: PublicCheckInFormSubmission;
}

function formatAnswer(field: CheckInFormField | undefined, value: string | boolean | undefined) {
  if (value === undefined || value === null || value === '') return '—';
  if (typeof value === 'boolean') {
    if (field?.type === 'yes_no') return value ? 'Yes' : 'No';
    return value ? 'Yes' : 'No';
  }
  return String(value);
}

export function CheckInFormSubmissionPanel({
  form,
  submission,
}: CheckInFormSubmissionPanelProps) {
  const fields = [...(form?.fields ?? [])].sort((a, b) => a.sortOrder - b.sortOrder);
  const knownIds = new Set(fields.map((field) => field.id));
  const extraEntries = Object.entries(submission.answers).filter(([id]) => !knownIds.has(id));

  return (
    <div className="attendee-detail-section" style={{ marginTop: 16 }}>
      <h3 style={{ marginTop: 0 }}>{form?.title?.trim() || 'Submitted waiver'}</h3>
      <dl className="attendee-detail-grid" style={{ marginBottom: 12 }}>
        <div className="attendee-detail-row">
          <dt>Signed name</dt>
          <dd>{submission.signedName || '—'}</dd>
        </div>
        <div className="attendee-detail-row">
          <dt>Submitted</dt>
          <dd>
            {submission.submittedAt
              ? formatUsDateTime(submission.submittedAt)
              : '—'}
          </dd>
        </div>
        {fields.map((field) => (
          <div key={field.id} className="attendee-detail-row">
            <dt>{field.label}</dt>
            <dd>{formatAnswer(field, submission.answers[field.id])}</dd>
          </div>
        ))}
        {extraEntries.map(([id, value]) => (
          <div key={id} className="attendee-detail-row">
            <dt>{id}</dt>
            <dd>{formatAnswer(undefined, value)}</dd>
          </div>
        ))}
      </dl>
      {submission.signatureDataUrl ? (
        <div>
          <p className="muted" style={{ marginBottom: 8 }}>
            Signature
          </p>
          <div
            style={{
              background: '#fff',
              border: '1px solid var(--line)',
              borderRadius: 12,
              padding: 10,
              maxWidth: 420,
            }}
          >
            <img
              src={submission.signatureDataUrl}
              alt="Attendee signature"
              style={{ display: 'block', width: '100%', height: 'auto' }}
            />
          </div>
        </div>
      ) : null}
    </div>
  );
}
