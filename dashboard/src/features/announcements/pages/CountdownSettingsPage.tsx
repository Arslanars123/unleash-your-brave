import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Bell } from 'lucide-react';
import { announcementsApi } from '@/features/announcements/api/announcements-api';
import { getApiErrorMessage } from '@/shared/api/client';
import type { CountdownCadence, CountdownRule } from '@/shared/types/api';
import { Button } from '@/shared/ui/Button';
import { Input } from '@/shared/ui/Input';
import { Spinner } from '@/shared/ui/Spinner';
import { TextArea } from '@/shared/ui/TextArea';
import { useToast } from '@/shared/ui/toast';

const CADENCE_OPTIONS: Array<{ value: CountdownCadence; label: string }> = [
  { value: 'once', label: 'Once (exact day)' },
  { value: 'daily', label: 'Daily (while within offset)' },
  { value: 'weekly', label: 'Weekly (while more than 7 days away)' },
];

export function CountdownSettingsPage() {
  const toast = useToast();
  const queryClient = useQueryClient();
  const [enabled, setEnabled] = useState(true);
  const [rules, setRules] = useState<CountdownRule[]>([]);

  const settingsQuery = useQuery({
    queryKey: ['announcements', 'countdown-settings'],
    queryFn: () => announcementsApi.getCountdownSettings(),
  });

  useEffect(() => {
    if (!settingsQuery.data) return;
    setEnabled(settingsQuery.data.enabled);
    setRules(settingsQuery.data.rules.map((rule) => ({ ...rule })));
  }, [settingsQuery.data]);

  const saveMutation = useMutation({
    mutationFn: () => announcementsApi.updateCountdownSettings({ enabled, rules }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['announcements', 'countdown-settings'] });
      toast.success('Countdown settings saved');
    },
    onError: (error) =>
      toast.error(getApiErrorMessage(error, 'Unable to save countdown settings')),
  });

  function updateRule(id: string, patch: Partial<CountdownRule>) {
    setRules((current) =>
      current.map((rule) => (rule.id === id ? { ...rule, ...patch } : rule)),
    );
  }

  return (
    <div className="page">
      <header className="page-header">
        <div>
          <Link to="/announcements" className="back-link">
            <ArrowLeft size={16} />
            Announcements
          </Link>
          <h1>Automatic countdown notifications</h1>
          <p className="muted">
            Control event countdown push notices — pause everything, edit wording, or change when
            each rule fires. Use {'{{daysLeft}}'} and {'{{eventName}}'} in templates.
          </p>
        </div>
        <Button
          loading={saveMutation.isPending}
          onClick={() => void saveMutation.mutateAsync()}
          disabled={settingsQuery.isLoading || rules.length === 0}
        >
          Save settings
        </Button>
      </header>

      {settingsQuery.isLoading ? <Spinner /> : null}
      {settingsQuery.isError ? (
        <p className="form-error">{getApiErrorMessage(settingsQuery.error)}</p>
      ) : null}

      {settingsQuery.data ? (
        <>
          <label className="checkbox-row" style={{ marginBottom: 24 }}>
            <input
              type="checkbox"
              checked={enabled}
              onChange={(e) => setEnabled(e.target.checked)}
            />
            <span>
              <strong>Automatic countdown notifications enabled</strong>
              <div className="muted">
                When off, no new countdown notices or pushes are created. Existing history stays in
                the attendee feed.
              </div>
            </span>
          </label>

          <div className="stack-gap">
            {rules.map((rule) => (
              <section key={rule.id} className="panel">
                <div className="panel-header">
                  <div>
                    <h2>
                      <Bell size={16} style={{ marginRight: 8, verticalAlign: 'text-bottom' }} />
                      {rule.label}
                    </h2>
                    <p className="muted">Rule id: {rule.id}</p>
                  </div>
                  <label className="checkbox-row">
                    <input
                      type="checkbox"
                      checked={rule.enabled}
                      onChange={(e) => updateRule(rule.id, { enabled: e.target.checked })}
                    />
                    Enabled
                  </label>
                </div>

                <div className="form-grid-2">
                  <Input
                    label="Label"
                    value={rule.label}
                    onChange={(e) => updateRule(rule.id, { label: e.target.value })}
                  />
                  <Input
                    label="Days before event (offset)"
                    type="number"
                    min={0}
                    max={365}
                    value={rule.offsetDays}
                    onChange={(e) =>
                      updateRule(rule.id, { offsetDays: Number(e.target.value) || 0 })
                    }
                  />
                  <label className="field">
                    <span className="field-label">Cadence</span>
                    <select
                      className="field-input"
                      value={rule.cadence}
                      onChange={(e) =>
                        updateRule(rule.id, {
                          cadence: e.target.value as CountdownCadence,
                        })
                      }
                    >
                      {CADENCE_OPTIONS.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>

                <Input
                  label="Title template"
                  value={rule.titleTemplate}
                  onChange={(e) => updateRule(rule.id, { titleTemplate: e.target.value })}
                />
                <TextArea
                  label="Body template"
                  value={rule.bodyTemplate}
                  onChange={(e) => updateRule(rule.id, { bodyTemplate: e.target.value })}
                />
              </section>
            ))}
          </div>
        </>
      ) : null}
    </div>
  );
}
