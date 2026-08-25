import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { eventsApi } from '@/features/events/api/events-api';
import {
  EventAssociationPicker,
  type EventAssociationSelection,
} from '@/features/events/components/EventAssociationPicker';
import { getApiErrorMessage } from '@/shared/api/client';
import type { PublicEvent } from '@/shared/types/api';
import { Button } from '@/shared/ui/Button';
import { useToast } from '@/shared/ui/toast';

interface EventAssociationsPanelProps {
  event: PublicEvent;
}

/** Edit membership / speaker / sponsor links for an existing edition. */
export function EventAssociationsPanel({ event }: EventAssociationsPanelProps) {
  const toast = useToast();
  const queryClient = useQueryClient();
  const [selection, setSelection] = useState<EventAssociationSelection>({
    speakerIds: [],
    sponsorIds: [],
    membershipIds: [],
  });

  const associationsQuery = useQuery({
    queryKey: ['events', event.id, 'associations'],
    queryFn: () => eventsApi.getAssociations(event.id),
  });

  useEffect(() => {
    if (!associationsQuery.data) return;
    setSelection({
      speakerIds: associationsQuery.data.speakerIds,
      sponsorIds: associationsQuery.data.sponsorIds,
      membershipIds: associationsQuery.data.membershipIds,
    });
  }, [associationsQuery.data]);

  const saveMutation = useMutation({
    mutationFn: () => eventsApi.setAssociations(event.id, selection),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['events', event.id, 'associations'] }),
        queryClient.invalidateQueries({ queryKey: ['speakers'] }),
        queryClient.invalidateQueries({ queryKey: ['sponsors'] }),
        queryClient.invalidateQueries({ queryKey: ['memberships'] }),
      ]);
      toast.success('Event associations saved');
    },
    onError: (error) =>
      toast.error(getApiErrorMessage(error, 'Unable to save event associations')),
  });

  return (
    <section className="past-editions" style={{ marginTop: 24 }}>
      <h2>Associations for this edition</h2>
      <p className="muted">
        Link shared memberships, speakers, and sponsors to this event. You can reuse the same
        people or tiers on other events; sessions and content stay separate per event.
      </p>
      {associationsQuery.isError ? (
        <p className="form-error">{getApiErrorMessage(associationsQuery.error)}</p>
      ) : null}
      <EventAssociationPicker
        value={selection}
        onChange={setSelection}
        disabled={associationsQuery.isLoading || saveMutation.isPending}
      />
      <div className="page-header-actions" style={{ marginTop: 12 }}>
        <Button
          loading={saveMutation.isPending}
          disabled={associationsQuery.isLoading}
          onClick={() => void saveMutation.mutateAsync()}
        >
          Save associations
        </Button>
      </div>
    </section>
  );
}
