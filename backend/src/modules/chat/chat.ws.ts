import type { Server as HttpServer, IncomingMessage } from 'node:http';
import { WebSocketServer, WebSocket, type RawData } from 'ws';
import { logger } from '../../core/logger.js';
import { ForbiddenError, UnauthorizedError } from '../../core/errors/app-error.js';
import { verifyAccessToken } from '../auth/token.service.js';
import type { ChatHub, ChatRealtimeEvent } from './chat.hub.js';
import type { ChatService } from './chat.service.js';

type AuthedSocket = WebSocket & { userId?: string };

/**
 * Bidirectional chat transport (Messenger-style).
 * Path: /api/v1/chat/ws?access_token=...
 *
 * Server → client: same ChatHub events as SSE (`message.created`, `message.deleted`, …)
 * Client → server (optional):
 *   { "type": "chat.send", "clientId": "...", "body": "..." }
 *   { "type": "chat.delete", "messageId": "..." }
 *   { "type": "ping" }
 */
export function attachChatWebSocket(
  server: HttpServer,
  deps: { hub: ChatHub; chatService: ChatService },
): WebSocketServer {
  const wss = new WebSocketServer({
    server,
    path: '/api/v1/chat/ws',
  });

  const clients = new Set<AuthedSocket>();

  const broadcast = (event: ChatRealtimeEvent) => {
    const frame = JSON.stringify(event);
    for (const client of clients) {
      if (client.readyState === WebSocket.OPEN) {
        client.send(frame);
      }
    }
  };

  const unsubscribeHub = deps.hub.subscribe(broadcast);

  wss.on('connection', async (socket: AuthedSocket, req: IncomingMessage) => {
    try {
      const url = new URL(req.url ?? '', 'http://localhost');
      const token = url.searchParams.get('access_token') ?? undefined;
      if (!token) throw new UnauthorizedError('Missing access token');

      let userId: string;
      try {
        userId = verifyAccessToken(token).sub;
      } catch {
        throw new UnauthorizedError('Invalid or expired token');
      }

      try {
        await deps.chatService.getGroupSummary(userId);
      } catch (error) {
        if (error instanceof ForbiddenError) throw error;
        throw new ForbiddenError('Unable to join chat socket');
      }

      socket.userId = userId;
      clients.add(socket);

      socket.send(
        JSON.stringify({
          type: 'connected',
          at: new Date().toISOString(),
          payload: { ok: true, userId },
        }),
      );

      socket.on('message', (raw) => {
        void handleClientMessage(socket, raw, deps.chatService);
      });

      socket.on('close', () => {
        clients.delete(socket);
      });

      socket.on('error', () => {
        clients.delete(socket);
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unauthorized';
      socket.close(4401, message.slice(0, 120));
    }
  });

  wss.on('close', () => {
    unsubscribeHub();
  });

  logger.info({ path: '/api/v1/chat/ws' }, 'Chat WebSocket attached');
  return wss;
}

async function handleClientMessage(
  socket: AuthedSocket,
  raw: RawData,
  chatService: ChatService,
): Promise<void> {
  const userId = socket.userId;
  if (!userId) return;

  let parsed: Record<string, unknown>;
  try {
    parsed = JSON.parse(String(raw)) as Record<string, unknown>;
  } catch {
    socket.send(
      JSON.stringify({
        type: 'error',
        at: new Date().toISOString(),
        payload: { message: 'Invalid JSON' },
      }),
    );
    return;
  }

  const type = typeof parsed.type === 'string' ? parsed.type : '';

  try {
    if (type === 'ping') {
      socket.send(JSON.stringify({ type: 'pong', at: new Date().toISOString(), payload: {} }));
      return;
    }

    if (type === 'chat.send') {
      const body = typeof parsed.body === 'string' ? parsed.body.trim() : '';
      const clientId =
        typeof parsed.clientId === 'string' && parsed.clientId
          ? parsed.clientId
          : `ws-${Date.now()}`;
      if (!body) {
        throw new Error('Message body required');
      }
      // Persists + publishes message.created on the hub (broadcast to all sockets).
      await chatService.sendMessage(userId, {
        clientId,
        type: 'text',
        body,
      });
      return;
    }

    if (type === 'chat.delete') {
      const messageId = typeof parsed.messageId === 'string' ? parsed.messageId : '';
      if (!messageId) throw new Error('messageId required');
      await chatService.deleteMessage(userId, messageId);
      return;
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Request failed';
    socket.send(
      JSON.stringify({
        type: 'error',
        at: new Date().toISOString(),
        payload: { message },
      }),
    );
  }
}
