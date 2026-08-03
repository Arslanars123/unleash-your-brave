import { useQuery } from '@tanstack/react-query';
import { useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { eventsApi } from '@/features/events/api/events-api';
import type { PublicEvent } from '@/shared/types/api';

export function formatEditionRange(event: Pick<PublicEvent, 'startDate' | 'endDate'>): string {
  const start = formatUtcDate(event.startDate);
  const end = formatUtcDate(event.endDate);
  return start === end ? start : `${start} – ${end}`;
}

function formatUtcDate(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    timeZone: 'UTC',
  });
}

/**
 * Shared edition scope for Speakers / Sessions / Sponsors.
 * Use `?edition=<id>` to browse a past edition. Admins can still edit past editions.
 */
export function useEditionScope() {
  const [params, setParams] = useSearchParams();
  const workspaceQuery = useQuery({
    queryKey: ['events', 'workspace'],
    queryFn: () => eventsApi.getWorkspace(),
  });

  const currentEdition = workspaceQuery.data?.current ?? null;
  const pastEditions = workspaceQuery.data?.pastEditions ?? [];

  const editions = useMemo(() => {
    if (!currentEdition) return pastEditions;
    return [currentEdition, ...pastEditions];
  }, [currentEdition, pastEditions]);

  const editionIdFromUrl = params.get('edition');
  const selectedEdition =
    editions.find((edition) => edition.id === editionIdFromUrl) ?? currentEdition;

  const isPastEdition = Boolean(
    selectedEdition && currentEdition && selectedEdition.id !== currentEdition.id,
  );
  /** Admins may manage content for any selected edition, including past ones. */
  const isReadOnly = false;

  function selectEdition(editionId: string) {
    const next = new URLSearchParams(params);
    if (!currentEdition || editionId === currentEdition.id) {
      next.delete('edition');
    } else {
      next.set('edition', editionId);
    }
    setParams(next, { replace: true });
  }

  function clearEditionFilter() {
    const next = new URLSearchParams(params);
    next.delete('edition');
    setParams(next, { replace: true });
  }

  return {
    workspaceQuery,
    editions,
    currentEdition,
    pastEditions,
    selectedEdition,
    eventId: selectedEdition?.id,
    isPastEdition,
    isReadOnly,
    selectEdition,
    clearEditionFilter,
  };
}
