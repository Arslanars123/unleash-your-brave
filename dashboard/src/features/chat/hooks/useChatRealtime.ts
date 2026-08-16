import { useEffect, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import type { ChatMessageView } from '@/features/chat/api/chat-api';
import { tokenStorage } from '@/shared/lib/token-storage';

const apiBase = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:4000/api/v1';

function toStreamUrl(httpBase: string, token: string): string {
  const url = new URL(`${httpBase.replace(/\/$/, '')}/chat/stream`);
  url.searchParams.set('access_token', token);
  return url.toString();
}

function upsertMessage(
  list: ChatMessageView[] | undefined,
  message: ChatMessageView,
): ChatMessageView[] {
  const current = list ?? [];
  const idx = current.findIndex(
    (m) => m.id === message.id || (message.clientId && m.clientId === message.clientId),
  );
  if (idx >= 0) {
    const next = [...current];
    next[idx] = message;
    return next;
  }
  return [...current, message];
}

export type ChatSocketHandle = {
  sendText: (body: string, clientId: string) => boolean;
  deleteMessage: (messageId: string) => boolean;
  ready: () => boolean;
};

/**
 * Live group chat over SSE (`/chat/stream`).
 * App Runner rejects WebSocket upgrades (403); SSE is the supported realtime path.
 */
export function useChatRealtime(enabled = true): ChatSocketHandle {
  const queryClient = useQueryClient();
  const connectedRef = useRef(false);

  useEffect(() => {
    if (!enabled) return;

    const token = tokenStorage.getAccess();
    if (!token) return;

    let closed = false;
    let retryTimer: number | undefined;
    let source: EventSource | null = null;
    let pollTimer: number | undefined;

    const applyEvent = (data: {
      type?: string;
      payload?: { message?: ChatMessageView; messageId?: string };
    }) => {
      if (data.type === 'message.created') {
        const message = data.payload?.message;
        if (!message?.id) return;
        queryClient.setQueryData<ChatMessageView[]>(['chat', 'messages'], (prev) =>
          upsertMessage(prev, message),
        );
        void queryClient.invalidateQueries({ queryKey: ['chat', 'group'] });
        return;
      }

      if (data.type === 'message.deleted') {
        const messageId = data.payload?.messageId;
        if (!messageId) return;
        queryClient.setQueryData<ChatMessageView[]>(['chat', 'messages'], (prev) =>
          (prev ?? []).filter((m) => m.id !== messageId),
        );
        void queryClient.invalidateQueries({ queryKey: ['chat', 'group'] });
        return;
      }

      if (data.type === 'group.updated') {
        void queryClient.invalidateQueries({ queryKey: ['chat', 'group'] });
      }
    };

    const connect = () => {
      if (closed) return;
      source?.close();
      source = new EventSource(toStreamUrl(apiBase, token));

      source.onopen = () => {
        connectedRef.current = true;
      };

      const onFrame = (event: MessageEvent<string>) => {
        try {
          const data = JSON.parse(String(event.data)) as {
            type?: string;
            payload?: { message?: ChatMessageView; messageId?: string };
          };
          // Named SSE events include type in data JSON already.
          if (!data.type && event.type && event.type !== 'message') {
            data.type = event.type;
          }
          applyEvent(data);
        } catch {
          // ignore malformed frames
        }
      };

      source.addEventListener('connected', onFrame);
      source.addEventListener('message.created', onFrame);
      source.addEventListener('message.deleted', onFrame);
      source.addEventListener('group.updated', onFrame);
      source.addEventListener('receipt.delivered', onFrame);
      source.addEventListener('receipt.read', onFrame);
      source.onmessage = onFrame;

      source.onerror = () => {
        connectedRef.current = false;
        source?.close();
        source = null;
        if (!closed) {
          retryTimer = window.setTimeout(connect, 2_000);
        }
      };
    };

    connect();
    // Lightweight poll backup while SSE reconnects.
    pollTimer = window.setInterval(() => {
      void queryClient.invalidateQueries({ queryKey: ['chat', 'messages'] });
      void queryClient.invalidateQueries({ queryKey: ['chat', 'group'] });
    }, 8_000);

    return () => {
      closed = true;
      connectedRef.current = false;
      if (retryTimer) window.clearTimeout(retryTimer);
      if (pollTimer) window.clearInterval(pollTimer);
      source?.close();
    };
  }, [enabled, queryClient]);

  return {
    ready: () => connectedRef.current,
    // Send always goes over HTTP — App Runner WS is unavailable.
    sendText: () => false,
    deleteMessage: () => false,
  };
}
