import { useEffect, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { tokenStorage } from '@/shared/lib/token-storage';
import { useToast } from '@/shared/ui/toast';

const apiBase = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:4000/api/v1';

function playNotificationBeep() {
  try {
    const AudioCtx =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    const oscillator = ctx.createOscillator();
    const gain = ctx.createGain();
    oscillator.type = 'sine';
    oscillator.frequency.value = 880;
    gain.gain.value = 0.04;
    oscillator.connect(gain);
    gain.connect(ctx.destination);
    oscillator.start();
    gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.35);
    oscillator.stop(ctx.currentTime + 0.35);
    window.setTimeout(() => void ctx.close(), 500);
  } catch {
    // Ignore autoplay / AudioContext failures.
  }
}

/**
 * Live announcement stream for speaker/sponsor dashboards.
 */
export function usePortalAnnouncementRealtime(enabled = true): void {
  const queryClient = useQueryClient();
  const toast = useToast();
  const readyRef = useRef(false);

  useEffect(() => {
    if (!enabled) return;

    const token = tokenStorage.getAccess();
    if (!token) return;

    readyRef.current = false;
    const url = `${apiBase}/realtime/stream?access_token=${encodeURIComponent(token)}`;
    const source = new EventSource(url);

    const onPublished = (event: MessageEvent) => {
      void queryClient.invalidateQueries({ queryKey: ['announcements', 'feed'] });
      void queryClient.invalidateQueries({ queryKey: ['announcements', 'unread-count'] });

      try {
        const data = JSON.parse(String(event.data)) as {
          payload?: { title?: string; description?: string };
        };
        const title = data.payload?.title?.trim() || 'New announcement';
        toast.success(title);
        if (readyRef.current) playNotificationBeep();
      } catch {
        toast.success('New announcement');
        if (readyRef.current) playNotificationBeep();
      }
    };

    source.addEventListener('connected', () => {
      readyRef.current = true;
    });
    source.addEventListener('announcement.published', onPublished as EventListener);

    source.onerror = () => {
      // Browser retries EventSource automatically.
    };

    return () => {
      source.removeEventListener('announcement.published', onPublished as EventListener);
      source.close();
    };
  }, [enabled, queryClient, toast]);
}
