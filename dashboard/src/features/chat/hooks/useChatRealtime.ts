import { useEffect, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import type { ChatMessageView } from '@/features/chat/api/chat-api';
import { tokenStorage } from '@/shared/lib/token-storage';

const apiBase = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:4000/api/v1';

function toWsUrl(httpBase: string): string {
  const url = new URL(httpBase.replace(/\/$/, ''));
  url.protocol = url.protocol === 'https:' ? 'wss:' : 'ws:';
  url.pathname = `${url.pathname.replace(/\/$/, '')}/chat/ws`;
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
 * Live group chat over WebSocket (/api/v1/chat/ws) — same hub events as the mobile app.
 * Messenger uses MQTT-over-WebSocket; we use plain WebSocket pub/sub for the same instant UX.
 */
export function useChatRealtime(enabled = true): ChatSocketHandle {
  const queryClient = useQueryClient();
  const socketRef = useRef<WebSocket | null>(null);

  useEffect(() => {
    if (!enabled) return;

    const token = tokenStorage.getAccess();
    if (!token) return;

    let closed = false;
    let retryTimer: number | undefined;
    let pingTimer: number | undefined;
    let socket: WebSocket | null = null;

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

      const url = `${toWsUrl(apiBase)}?access_token=${encodeURIComponent(token)}`;
      socket = new WebSocket(url);
      socketRef.current = socket;

      socket.onopen = () => {
        pingTimer = window.setInterval(() => {
          if (socket?.readyState === WebSocket.OPEN) {
            socket.send(JSON.stringify({ type: 'ping' }));
          }
        }, 25_000);
      };

      socket.onmessage = (event) => {
        try {
          const data = JSON.parse(String(event.data)) as {
            type?: string;
            payload?: { message?: ChatMessageView; messageId?: string };
          };
          applyEvent(data);
        } catch {
          // ignore malformed frames
        }
      };

      socket.onclose = () => {
        socketRef.current = null;
        if (pingTimer) window.clearInterval(pingTimer);
        if (!closed) {
          retryTimer = window.setTimeout(connect, 2_000);
        }
      };

      socket.onerror = () => {
        socket?.close();
      };
    };

    connect();

    return () => {
      closed = true;
      if (retryTimer) window.clearTimeout(retryTimer);
      if (pingTimer) window.clearInterval(pingTimer);
      socket?.close();
      socketRef.current = null;
    };
  }, [enabled, queryClient]);

  return {
    ready: () => socketRef.current?.readyState === WebSocket.OPEN,
    sendText: (body, clientId) => {
      const ws = socketRef.current;
      if (!ws || ws.readyState !== WebSocket.OPEN) return false;
      ws.send(JSON.stringify({ type: 'chat.send', clientId, body }));
      return true;
    },
    deleteMessage: (messageId) => {
      const ws = socketRef.current;
      if (!ws || ws.readyState !== WebSocket.OPEN) return false;
      ws.send(JSON.stringify({ type: 'chat.delete', messageId }));
      return true;
    },
  };
}
