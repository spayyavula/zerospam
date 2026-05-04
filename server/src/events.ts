import { EventEmitter } from 'node:events';

export type AppEvent =
  | { type: 'message:new'; mailboxId: number; messageId: string; folder: string }
  | { type: 'message:updated'; mailboxId: number; messageId: string }
  | { type: 'message:deleted'; mailboxId: number; messageId: string }
  | { type: 'whitelist:changed'; mailboxId: number }
  | { type: 'screener:changed'; mailboxId: number };

class Bus extends EventEmitter {
  publish(e: AppEvent) {
    this.emit('event', e);
  }
}

export const bus = new Bus();
bus.setMaxListeners(100);
