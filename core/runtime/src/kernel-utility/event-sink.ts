/**
 * EventSink — kernel-utility side of the Main ↔ renderer event stream.
 *
 * Architecture: the kernel utility never holds a renderer-facing
 * MessagePort directly. Events originate here (e.g. `mesh.auth.required`
 * from truffle's `onAuthRequired` callback), are handed to the sink, and
 * are forwarded to the main process over the existing ctrl Comlink
 * channel via a subscriber callback installed by main.
 *
 * Main forwards each event onto every connected renderer's event port
 * (spec 05 §2: main stays the broker; kernel utility never holds
 * renderer ports). This avoids minting a second utility↔renderer channel
 * per window.
 *
 * Exactly one active subscriber — a later `setSubscriber()` call replaces
 * the earlier one. Events emitted before a subscriber attaches are
 * buffered (bounded FIFO) so the boot-time `mesh.auth.required` fires
 * don't get dropped.
 */

import type { EventPortMessage, VibeEvents } from '../ipc/events.js';
import type { KernelEventCallback } from '../ipc/kernel-ctrl.js';
import { createScopedLogger } from '../logging/index.js';

const log = createScopedLogger('kernel-utility:event-sink');

const MAX_BUFFERED = 64;

export interface EventSink {
  emit<E extends keyof VibeEvents>(type: E, payload: VibeEvents[E]): void;
  setSubscriber(cb: KernelEventCallback | null): void;
}

export function createEventSink(): EventSink {
  let subscriber: KernelEventCallback | null = null;
  const buffer: EventPortMessage[] = [];

  return {
    emit(type, payload) {
      const msg = { type, payload } as EventPortMessage;
      if (subscriber) {
        try {
          subscriber(msg);
        } catch (err) {
          log.warn({ err: String(err), type }, 'event subscriber threw');
        }
        return;
      }
      if (buffer.length >= MAX_BUFFERED) buffer.shift();
      buffer.push(msg);
    },
    setSubscriber(cb) {
      subscriber = cb;
      if (!cb) return;
      while (buffer.length > 0) {
        const msg = buffer.shift();
        if (!msg) continue;
        try {
          cb(msg);
        } catch (err) {
          log.warn({ err: String(err), type: msg.type }, 'event subscriber threw on drain');
        }
      }
    },
  };
}
