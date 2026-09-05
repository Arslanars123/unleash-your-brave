import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Pencil, Plus, Trash2 } from 'lucide-react';
import { SessionFormModal } from '@/features/sessions/components/SessionFormModal';
import { membershipsApi } from '@/features/memberships/api/memberships-api';
import type { PublicEventDay, PublicSession, SessionPayload } from '@/shared/types/api';
import { Button } from '@/shared/ui/Button';

export interface DraftSession {
  key: string;
  payload: SessionPayload;
}

interface EventWizardSessionsStepProps {
  eventDays: PublicEventDay[];
  linkedMembershipIds: string[];
  sessions: DraftSession[];
  onChange: (sessions: DraftSession[]) => void;
  disabled?: boolean;
}

function newSessionKey(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function draftToPublicSession(draft: DraftSession): PublicSession {
  const payload = draft.payload;
  return {
    id: draft.key,
    eventId: '',
    kind: payload.kind ?? 'session',
    name: payload.name,
    description: payload.description ?? '',
    address: payload.address ?? '',
    eventDayNumber: payload.eventDayNumber,
    startTime: payload.startTime ?? '',
    endTime: payload.endTime ?? '',
    location: payload.location ?? '',
    membershipIds: [...(payload.membershipIds ?? [])],
    materials: (payload.materials ?? []).map((material, index) => ({
      id: material.id || String(index),
      type: material.type,
      title: material.title,
      url: material.url,
    })),
    feedbackEnabled: payload.feedbackEnabled ?? true,
    feedbackSummary: { averageRating: 0, ratingsCount: 0 },
    accessRestricted: (payload.membershipIds?.length ?? 0) > 0,
    createdAt: '',
    updatedAt: '',
  };
}

export function draftSessionsToPayloads(sessions: DraftSession[]): SessionPayload[] {
  return sessions.map((item) => item.payload);
}

export function publicSessionToDraft(session: PublicSession): DraftSession {
  return {
    key: session.id,
    payload: {
      kind: session.kind ?? 'session',
      name: session.name,
      description: session.description,
      address: session.address ?? '',
      eventDayNumber: session.eventDayNumber,
      startTime: session.startTime ?? '',
      endTime: session.endTime ?? '',
      location: session.location ?? '',
      membershipIds: [...(session.membershipIds ?? [])],
      materials: (session.materials ?? []).map((material) => ({
        id: material.id,
        type: material.type,
        title: material.title,
        url: material.url,
      })),
      feedbackEnabled: session.feedbackEnabled ?? true,
    },
  };
}

export function EventWizardSessionsStep({
  eventDays,
  linkedMembershipIds,
  sessions,
  onChange,
  disabled = false,
}: EventWizardSessionsStepProps) {
  const [sessionModalOpen, setSessionModalOpen] = useState(false);
  const [editingKey, setEditingKey] = useState<string | null>(null);

  const membershipsQuery = useQuery({
    queryKey: ['memberships', 'library', 'event-wizard'],
    queryFn: () => membershipsApi.list({ perPage: 100 }),
  });

  const memberships = useMemo(() => {
    const items = membershipsQuery.data?.items ?? [];
    if (linkedMembershipIds.length === 0) return items;
    return items.filter((item) => linkedMembershipIds.includes(item.id));
  }, [linkedMembershipIds, membershipsQuery.data?.items]);

  const editingSession = sessions.find((item) => item.key === editingKey) ?? null;

  const dayLabel = (dayNumber: number) => {
    const day = eventDays.find((item) => item.dayNumber === dayNumber);
    if (!day) return `Day ${dayNumber}`;
    return day.label?.trim() || `Day ${day.dayNumber}`;
  };

  function openCreateSession() {
    setEditingKey(null);
    setSessionModalOpen(true);
  }

  function openEditSession(key: string) {
    setEditingKey(key);
    setSessionModalOpen(true);
  }

  function removeSession(key: string) {
    onChange(sessions.filter((item) => item.key !== key));
  }

  async function handleSessionSubmit(payload: SessionPayload) {
    if (editingKey) {
      onChange(
        sessions.map((item) => (item.key === editingKey ? { ...item, payload } : item)),
      );
    } else {
      onChange([...sessions, { key: newSessionKey(), payload }]);
    }
    setSessionModalOpen(false);
    setEditingKey(null);
  }

  return (
    <div className="wizard-step-panel">
      <p className="hint">
        Add agenda sessions for this edition. Choose which membership tiers can access each
        session. Speakers are managed in the Speakers step.
      </p>

      {linkedMembershipIds.length === 0 ? (
        <p className="form-error" style={{ marginTop: 0 }}>
          Link at least one membership in a previous step to assign session access.
        </p>
      ) : null}

      <div className="toolbar" style={{ marginBottom: 12 }}>
        <Button type="button" variant="secondary" disabled={disabled} onClick={openCreateSession}>
          <Plus size={16} />
          Add session
        </Button>
      </div>

      {sessions.length === 0 ? (
        <div className="empty-state compact">
          <p className="muted">
            No sessions yet. You can add them now or skip and build the agenda later.
          </p>
        </div>
      ) : (
        <ul className="wizard-draft-list">
          {sessions.map((item) => (
            <li key={item.key}>
              <div>
                <strong>{item.payload.name}</strong>
                <span className="muted">
                  {dayLabel(item.payload.eventDayNumber)}
                  {item.payload.startTime && item.payload.endTime
                    ? ` · ${item.payload.startTime}–${item.payload.endTime}`
                    : ''}
                </span>
                {(item.payload.membershipIds?.length ?? 0) > 0 ? (
                  <span className="muted">
                    Access:{' '}
                    {item.payload.membershipIds
                      ?.map((id) => memberships.find((tier) => tier.id === id)?.name ?? 'Tier')
                      .join(', ')}
                  </span>
                ) : (
                  <span className="muted">Open to all linked memberships</span>
                )}
              </div>
              <div className="wizard-draft-actions">
                <Button
                  type="button"
                  variant="ghost"
                  disabled={disabled}
                  onClick={() => openEditSession(item.key)}
                  aria-label="Edit session"
                >
                  <Pencil size={16} />
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  disabled={disabled}
                  onClick={() => removeSession(item.key)}
                  aria-label="Remove session"
                >
                  <Trash2 size={16} />
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}

      <SessionFormModal
        open={sessionModalOpen}
        mode={editingSession ? 'edit' : 'create'}
        initialSession={editingSession ? draftToPublicSession(editingSession) : null}
        memberships={memberships}
        eventDays={eventDays}
        loading={false}
        onClose={() => {
          setSessionModalOpen(false);
          setEditingKey(null);
        }}
        onSubmit={handleSessionSubmit}
      />
    </div>
  );
}
