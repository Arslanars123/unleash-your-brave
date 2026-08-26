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
 * Shared edition scope for Speakers / Sessions / Sponsors / Check-ins / Store.
 * Use `?edition=<id>` to browse a non-current edition. Admins can still edit any edition.
 *
 * When `optional` is true (Attendees), no edition is selected until the admin picks one —
 * the list is unfiltered by default.
 */
export function useEditionScope(options?: { optional?: boolean }) {
  const optional = Boolean(options?.optional);
  const [params, setParams] = useSearchParams();
  const workspaceQuery = useQuery({
    queryKey: ['events', 'workspace'],
    queryFn: () => eventsApi.getWorkspace(),
  });

  const currentEdition = workspaceQuery.data?.current ?? null;
  const pastEditions = workspaceQuery.data?.pastEditions ?? [];
  const upcomingEditions = workspaceQuery.data?.upcomingEditions ?? [];
  const workspaceEditions = workspaceQuery.data?.editions;

  const editions = useMemo(() => {
    if (workspaceEditions && workspaceEditions.length > 0) {
      return workspaceEditions;
    }
    const byId = new Map<string, PublicEvent>();
    for (const edition of [currentEdition, ...upcomingEditions, ...pastEditions]) {
      if (edition) byId.set(edition.id, edition);
    }
    return Array.from(byId.values());
  }, [workspaceEditions, currentEdition, upcomingEditions, pastEditions]);

  const editionIdFromUrl = params.get('edition');
  const selectedEdition = optional
    ? editions.find((edition) => edition.id === editionIdFromUrl) ?? null
    : editions.find((edition) => edition.id === editionIdFromUrl) ?? currentEdition;

  const isNonCurrentEdition = Boolean(
    selectedEdition && currentEdition && selectedEdition.id !== currentEdition.id,
  );
  /** Ended editions only — scanner and “current event” labels use this. */
  const isPastEdition = Boolean(selectedEdition && selectedEdition.status === 'ended');
  /** Admins may manage content for any selected edition, including past ones. */
  const isReadOnly = false;

  function selectEdition(editionId: string) {
    const next = new URLSearchParams(params);
    if (!editionId) {
      next.delete('edition');
    } else if (optional) {
      // Keep the chosen edition in the URL even when it is the current one.
      next.set('edition', editionId);
    } else if (!currentEdition || editionId === currentEdition.id) {
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
    upcomingEditions,
    selectedEdition,
    eventId: selectedEdition?.id as string | undefined,
    isPastEdition,
    isNonCurrentEdition,
    isReadOnly,
    optional,
    selectEdition,
    clearEditionFilter,
  };
}
