import { useEffect, useState, type FormEvent } from 'react';
import { AuthLayout } from '@/features/auth/components/AuthLayout';
import { feedbackApi } from '@/features/feedback/api/feedback-api';
import { getApiErrorMessage } from '@/shared/api/client';
import { Button } from '@/shared/ui/Button';
import { Input } from '@/shared/ui/Input';
import { TextArea } from '@/shared/ui/TextArea';

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

interface FieldErrors {
  name?: string;
  email?: string;
  feedback?: string;
}

function validate(name: string, email: string, feedback: string): FieldErrors {
  const errors: FieldErrors = {};
  if (!name.trim()) errors.name = 'Name is required';
  const trimmedEmail = email.trim();
  if (!trimmedEmail) errors.email = 'Email is required';
  else if (!EMAIL_REGEX.test(trimmedEmail)) errors.email = 'Enter a valid email address';
  if (!feedback.trim()) errors.feedback = 'Feedback is required';
  return errors;
}

export function PublicFeedbackPage() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [feedback, setFeedback] = useState('');
  const [errors, setErrors] = useState<FieldErrors>({});
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  useEffect(() => {
    document.title = 'Share your feedback — Unleash Your Brave';
  }, []);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setSubmitted(true);
    setFormError(null);
    const nextErrors = validate(name, email, feedback);
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;

    setLoading(true);
    try {
      await feedbackApi.submit({
        name: name.trim(),
        email: email.trim(),
        feedback: feedback.trim(),
      });
      setDone(true);
    } catch (error) {
      setFormError(getApiErrorMessage(error, 'Unable to submit feedback'));
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthLayout
      kicker="Event feedback"
      brandLine="Tell us how the experience felt — your notes help us make the next edition braver."
    >
      {done ? (
        <div className="auth-form">
          <header className="auth-form-header">
            <p className="auth-form-eyebrow">Thank you</p>
            <h2>Feedback received</h2>
            <p className="muted">We appreciate you taking the time to share your thoughts.</p>
          </header>
        </div>
      ) : (
        <form className="auth-form" onSubmit={onSubmit} noValidate>
          <header className="auth-form-header">
            <p className="auth-form-eyebrow">Unleash Your Brave</p>
            <h2>Share your feedback</h2>
            <p className="muted">
              No login needed — just your name, email, and a few words about the event.
            </p>
          </header>

          <Input
            label="Name"
            name="name"
            autoComplete="name"
            requiredMark
            value={name}
            error={errors.name}
            onChange={(e) => {
              setName(e.target.value);
              if (submitted) setErrors(validate(e.target.value, email, feedback));
            }}
          />
          <Input
            label="Email"
            type="email"
            name="email"
            autoComplete="email"
            requiredMark
            value={email}
            error={errors.email}
            onChange={(e) => {
              setEmail(e.target.value);
              if (submitted) setErrors(validate(name, e.target.value, feedback));
            }}
          />
          <TextArea
            label="Feedback"
            name="feedback"
            requiredMark
            rows={6}
            value={feedback}
            error={errors.feedback}
            onChange={(e) => {
              setFeedback(e.target.value);
              if (submitted) setErrors(validate(name, email, e.target.value));
            }}
          />

          {formError ? <p className="form-error">{formError}</p> : null}

          <Button type="submit" loading={loading}>
            Submit feedback
          </Button>
        </form>
      )}
    </AuthLayout>
  );
}
