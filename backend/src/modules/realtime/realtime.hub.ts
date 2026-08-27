import { EventEmitter } from 'node:events';

export type RealtimeEventType =
  | 'attendee.upserted'
  | 'attendee.deleted'
  | 'announcement.published';

export interface RealtimeEvent {
  type: RealtimeEventType;
  at: string;
  payload?: Record<string, unknown>;
}

/**
 * In-process pub/sub for dashboard live updates (SSE).
 * Note: with multiple App Runner instances, each has its own hub.
 */
export class RealtimeHub {
  private readonly bus = new EventEmitter();

  constructor() {
    this.bus.setMaxListeners(100);
  }

  publish(event: Omit<RealtimeEvent, 'at'>): void {
    const full: RealtimeEvent = { ...event, at: new Date().toISOString() };
    this.bus.emit('event', full);
  }

  subscribe(listener: (event: RealtimeEvent) => void): () => void {
    this.bus.on('event', listener);
    return () => this.bus.off('event', listener);
  }
}
