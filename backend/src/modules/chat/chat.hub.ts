import { EventEmitter } from 'node:events';

export type ChatRealtimeEventType =
  | 'message.created'
  | 'reaction.updated'
  | 'receipt.delivered'
  | 'receipt.read'
  | 'group.updated';

export interface ChatRealtimeEvent {
  type: ChatRealtimeEventType;
  at: string;
  payload: Record<string, unknown>;
}

/**
 * In-process pub/sub for the attendee group chat SSE stream.
 * Same single-instance constraint as the admin RealtimeHub.
 */
export class ChatHub {
  private readonly bus = new EventEmitter();

  constructor() {
    this.bus.setMaxListeners(500);
  }

  publish(event: Omit<ChatRealtimeEvent, 'at'>): void {
    const full: ChatRealtimeEvent = { ...event, at: new Date().toISOString() };
    this.bus.emit('event', full);
  }

  subscribe(listener: (event: ChatRealtimeEvent) => void): () => void {
    this.bus.on('event', listener);
    return () => this.bus.off('event', listener);
  }
}
