import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { tokenStorage } from '@/shared/lib/token-storage';
import { useToast } from '@/shared/ui/toast';

const apiBase = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:4000/api/v1';

/**
 * Subscribe to backend SSE so Attendees list updates when GHL (or admin) upserts a member.
 */
export function useAttendeeRealtime(enabled = true): void {
  const queryClient = useQueryClient();
  const toast = useToast();

  useEffect(() => {
    if (!enabled) return;

    const token = tokenStorage.getAccess();
    if (!token) return;

    const url = `${apiBase}/realtime/stream?access_token=${encodeURIComponent(token)}`;
    const source = new EventSource(url);

    const onUpserted = (event: MessageEvent) => {
      void queryClient.invalidateQueries({ queryKey: ['users', 'list'] });
      void queryClient.invalidateQueries({ queryKey: ['users', 'stats'] });

      try {
        const data = JSON.parse(String(event.data)) as {
          payload?: { name?: string; email?: string; created?: boolean };
        };
        const label = data.payload?.name || data.payload?.email || 'Attendee';
        toast.success(
          data.payload?.created ? `New attendee: ${label}` : `Attendee updated: ${label}`,
        );
      } catch {
        toast.success('Attendees updated');
      }
    };

    source.addEventListener('attendee.upserted', onUpserted as EventListener);
    source.addEventListener('attendee.deleted', () => {
      void queryClient.invalidateQueries({ queryKey: ['users', 'list'] });
      void queryClient.invalidateQueries({ queryKey: ['users', 'stats'] });
    });

    source.onerror = () => {
      // Browser will retry EventSource automatically.
    };

    return () => {
      source.removeEventListener('attendee.upserted', onUpserted as EventListener);
      source.close();
    };
  }, [enabled, queryClient, toast]);
}
