import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Pencil, Plus, Trash2, UserPlus } from 'lucide-react';
import { SessionFormModal } from '@/features/sessions/components/SessionFormModal';
import { speakersApi } from '@/features/speakers/api/speakers-api';
import { SpeakerFormModal } from '@/features/speakers/components/SpeakerFormModal';
import { membershipsApi } from '@/features/memberships/api/memberships-api';
import { getApiErrorMessage } from '@/shared/api/client';
import type { PublicEventDay, PublicSession, SessionPayload } from '@/shared/types/api';
import { Button } from '@/shared/ui/Button';
import { useToast } from '@/shared/ui/toast';

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
    speakerId: payload.speakerId ?? null,
    address: payload.address ?? '',
    speaker: null,
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

export function EventWizardSessionsStep({
  eventDays,
  linkedMembershipIds,
  sessions,
  onChange,
  disabled = false,
}: EventWizardSessionsStepProps) {
  const toast = useToast();
  const queryClient = useQueryClient();
  const [sessionModalOpen, setSessionModalOpen] = useState(false);
  const [speakerModalOpen, setSpeakerModalOpen] = useState(false);
  const [editingKey, setEditingKey] = useState<string | null>(null);

  const speakersQuery = useQuery({
    queryKey: ['speakers', 'library', 'event-wizard'],
    queryFn: () => speakersApi.list({ perPage: 100 }),
  });

  const membershipsQuery = useQuery({
    queryKey: ['memberships', 'library', 'event-wizard'],
    queryFn: () => membershipsApi.list({ perPage: 100 }),
  });

  const createSpeakerMutation = useMutation({
    mutationFn: speakersApi.create,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['speakers'] });
      toast.success('Speaker created');
      setSpeakerModalOpen(false);
    },
    onError: (error) => toast.error(getApiErrorMessage(error, 'Unable to create speaker')),
  });

  const speakers = speakersQuery.data?.items ?? [];
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

  function speakerName(speakerId: string) {
    return speakers.find((speaker) => speaker.id === speakerId)?.name ?? 'Speaker';
  }

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
        Add agenda sessions for this edition. Pick an existing speaker or create a new one, then
        choose which membership tiers can access each session.
      </p>

      {linkedMembershipIds.length === 0 ? (
        <p className="form-error" style={{ marginTop: 0 }}>
          Link at least one membership in the previous step to assign session access.
        </p>
      ) : null}

      <div className="toolbar" style={{ marginBottom: 12 }}>
        <Button type="button" variant="secondary" disabled={disabled} onClick={openCreateSession}>
          <Plus size={16} />
          Add session
        </Button>
        <Button
          type="button"
          variant="ghost"
          disabled={disabled || createSpeakerMutation.isPending}
          onClick={() => setSpeakerModalOpen(true)}
        >
          <UserPlus size={16} />
          Create speaker
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
                  {item.payload.speakerId ? ` · ${speakerName(item.payload.speakerId)}` : ''}
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
        speakers={speakers}
        memberships={memberships}
        eventDays={eventDays}
        loading={false}
        onClose={() => {
          setSessionModalOpen(false);
          setEditingKey(null);
        }}
        onSubmit={handleSessionSubmit}
      />

      <SpeakerFormModal
        open={speakerModalOpen}
        mode="create"
        loading={createSpeakerMutation.isPending}
        onClose={() => setSpeakerModalOpen(false)}
        onSubmit={async (payload) => {
          await createSpeakerMutation.mutateAsync(payload);
        }}
      />
    </div>
  );
}
