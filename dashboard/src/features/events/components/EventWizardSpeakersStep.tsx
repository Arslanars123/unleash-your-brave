import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Pencil, Plus, Trash2 } from 'lucide-react';
import { speakersApi } from '@/features/speakers/api/speakers-api';
import { SpeakerFormModal } from '@/features/speakers/components/SpeakerFormModal';
import { getApiErrorMessage } from '@/shared/api/client';
import type { PublicSpeaker, SpeakerPayload } from '@/shared/types/api';
import { Button } from '@/shared/ui/Button';
import { useConfirm } from '@/shared/ui/ConfirmDialog';
import { Spinner } from '@/shared/ui/Spinner';
import { useToast } from '@/shared/ui/toast';

export interface DraftSpeaker {
  key: string;
  payload: Omit<SpeakerPayload, 'eventId' | 'eventIds'>;
}

interface EventWizardSpeakersStepProps {
  /** When set, speakers are saved immediately for this edition. */
  eventId?: string | null;
  speakers: DraftSpeaker[];
  onChange: (speakers: DraftSpeaker[]) => void;
  disabled?: boolean;
}

function newSpeakerKey(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export function draftSpeakersWithoutEvent(
  speakers: DraftSpeaker[],
): Array<Omit<SpeakerPayload, 'eventId' | 'eventIds'>> {
  return speakers.map((item) => item.payload);
}

/** @deprecated Prefer draftSpeakersWithoutEvent + assign eventId on create. */
export function draftSpeakersToPayloads(
  speakers: DraftSpeaker[],
  eventId: string,
): SpeakerPayload[] {
  return speakers.map((item) => ({ ...item.payload, eventId }));
}

export function EventWizardSpeakersStep({
  eventId,
  speakers,
  onChange,
  disabled = false,
}: EventWizardSpeakersStepProps) {
  const toast = useToast();
  const queryClient = useQueryClient();
  const { confirm } = useConfirm();
  const [modalOpen, setModalOpen] = useState(false);
  const [editingKey, setEditingKey] = useState<string | null>(null);
  const [editingLive, setEditingLive] = useState<PublicSpeaker | null>(null);

  const liveMode = Boolean(eventId);

  const liveQuery = useQuery({
    queryKey: ['speakers', 'event-wizard', eventId],
    queryFn: () => speakersApi.list({ eventId: eventId!, perPage: 100 }),
    enabled: liveMode,
  });

  const createMutation = useMutation({
    mutationFn: speakersApi.create,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['speakers'] });
      toast.success('Speaker created');
      closeModal();
    },
    onError: (error) => toast.error(getApiErrorMessage(error, 'Unable to create speaker')),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: SpeakerPayload }) =>
      speakersApi.update(id, payload),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['speakers'] });
      toast.success('Speaker updated');
      closeModal();
    },
    onError: (error) => toast.error(getApiErrorMessage(error, 'Unable to update speaker')),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => speakersApi.remove(id),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['speakers'] });
      toast.success('Speaker deleted');
    },
    onError: (error) => toast.error(getApiErrorMessage(error, 'Unable to delete speaker')),
  });

  const liveSpeakers = liveQuery.data?.items ?? [];
  const editingDraft = speakers.find((item) => item.key === editingKey) ?? null;
  const saving =
    createMutation.isPending || updateMutation.isPending || deleteMutation.isPending;

  function closeModal() {
    setModalOpen(false);
    setEditingKey(null);
    setEditingLive(null);
  }

  function openCreate() {
    setEditingKey(null);
    setEditingLive(null);
    setModalOpen(true);
  }

  function openEditDraft(key: string) {
    setEditingKey(key);
    setEditingLive(null);
    setModalOpen(true);
  }

  function openEditLive(speaker: PublicSpeaker) {
    setEditingLive(speaker);
    setEditingKey(null);
    setModalOpen(true);
  }

  function removeDraft(key: string) {
    onChange(speakers.filter((item) => item.key !== key));
  }

  async function removeLive(speaker: PublicSpeaker) {
    const linked =
      speaker.eventIds && speaker.eventIds.length > 0
        ? speaker.eventIds
        : speaker.eventId
          ? [speaker.eventId]
          : [];
    const onlyThisEdition = linked.length <= 1 || !eventId || !linked.includes(eventId);

    const ok = await confirm({
      title: onlyThisEdition ? 'Delete speaker?' : 'Remove from this event?',
      message: onlyThisEdition
        ? `Delete “${speaker.name}”? This cannot be undone.`
        : `Remove “${speaker.name}” from this event only? They stay linked to other events.`,
      confirmLabel: onlyThisEdition ? 'Delete' : 'Remove',
      tone: 'danger',
    });
    if (!ok) return;

    if (onlyThisEdition) {
      await deleteMutation.mutateAsync(speaker.id);
      return;
    }

    await updateMutation.mutateAsync({
      id: speaker.id,
      payload: {
        name: speaker.name,
        email: speaker.email || undefined,
        title: speaker.title,
        description: speaker.description,
        photo: speaker.photo,
        eventIds: linked.filter((id) => id !== eventId),
      },
    });
  }

  async function handleSubmit(payload: SpeakerPayload) {
    if (liveMode && eventId) {
      if (editingLive) {
        // Don't replace multi-event associations from the edition wizard — profile only.
        const profile: SpeakerPayload = {
          name: payload.name,
          email: payload.email,
          title: payload.title,
          description: payload.description,
          photo: payload.photo,
        };
        await updateMutation.mutateAsync({ id: editingLive.id, payload: profile });
      } else {
        await createMutation.mutateAsync({ ...payload, eventIds: [eventId] });
      }
      return;
    }

    const draftPayload: Omit<SpeakerPayload, 'eventId' | 'eventIds'> = {
      name: payload.name,
      email: payload.email,
      title: payload.title,
      description: payload.description,
      photo: payload.photo,
    };
    if (editingKey) {
      onChange(
        speakers.map((item) =>
          item.key === editingKey ? { ...item, payload: draftPayload } : item,
        ),
      );
    } else {
      onChange([...speakers, { key: newSpeakerKey(), payload: draftPayload }]);
    }
    closeModal();
  }

  const initialSpeaker: PublicSpeaker | null = editingLive
    ? editingLive
    : editingDraft
      ? {
          id: editingDraft.key,
          eventId: eventId ?? '',
          name: editingDraft.payload.name,
          email: editingDraft.payload.email ?? '',
          title: editingDraft.payload.title ?? '',
          description: editingDraft.payload.description ?? '',
          photo: editingDraft.payload.photo ?? '',
          createdAt: '',
          updatedAt: '',
        }
      : null;

  return (
    <div className="wizard-step-panel">
      <p className="hint">
        Add speakers for this edition. Speakers belong to the event — not to individual sessions.
      </p>

      <div className="toolbar" style={{ marginBottom: 12 }}>
        <Button type="button" variant="secondary" disabled={disabled || saving} onClick={openCreate}>
          <Plus size={16} />
          Add speaker
        </Button>
      </div>

      {liveMode && liveQuery.isLoading ? <Spinner /> : null}

      {liveMode ? (
        liveSpeakers.length === 0 && !liveQuery.isLoading ? (
          <div className="empty-state compact">
            <p className="muted">No speakers yet. You can add them now or skip and add later.</p>
          </div>
        ) : (
          <ul className="wizard-draft-list">
            {liveSpeakers.map((speaker) => (
              <li key={speaker.id}>
                <div>
                  <strong>{speaker.name}</strong>
                  {speaker.title ? <span className="muted">{speaker.title}</span> : null}
                </div>
                <div className="wizard-draft-actions">
                  <Button
                    type="button"
                    variant="ghost"
                    disabled={disabled || saving}
                    onClick={() => openEditLive(speaker)}
                    aria-label="Edit speaker"
                  >
                    <Pencil size={16} />
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    disabled={disabled || saving}
                    onClick={() => void removeLive(speaker)}
                    aria-label="Remove speaker"
                  >
                    <Trash2 size={16} />
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )
      ) : speakers.length === 0 ? (
        <div className="empty-state compact">
          <p className="muted">No speakers yet. You can add them now or skip and add later.</p>
        </div>
      ) : (
        <ul className="wizard-draft-list">
          {speakers.map((item) => (
            <li key={item.key}>
              <div>
                <strong>{item.payload.name}</strong>
                {item.payload.title ? <span className="muted">{item.payload.title}</span> : null}
              </div>
              <div className="wizard-draft-actions">
                <Button
                  type="button"
                  variant="ghost"
                  disabled={disabled}
                  onClick={() => openEditDraft(item.key)}
                  aria-label="Edit speaker"
                >
                  <Pencil size={16} />
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  disabled={disabled}
                  onClick={() => removeDraft(item.key)}
                  aria-label="Remove speaker"
                >
                  <Trash2 size={16} />
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}

      <SpeakerFormModal
        open={modalOpen}
        mode={initialSpeaker ? 'edit' : 'create'}
        initialSpeaker={initialSpeaker}
        eventId={eventId ?? undefined}
        hideEventSelect
        loading={saving}
        onClose={closeModal}
        onSubmit={handleSubmit}
      />
    </div>
  );
}
