/**
 * Event-port message envelope. Flows kernel → renderer over a dedicated
 * `MessagePort` (spec 05 §6.2). The renderer never replies on this port;
 * request/response goes through `invoke()` (§6.1).
 *
 * `VibeEvents` is the kernel-owned catalog defined in
 * `@vibe-ctl/plugin-api` (spec 01 §12). Plugins extend it via
 * declaration merging.
 */

import type { VibeEvents } from '@vibe-ctl/plugin-api';

/**
 * One message on the event port. `type` is a key of `VibeEvents`;
 * `payload` is typed to the matching entry.
 */
export type EventPortMessage = {
  [K in keyof VibeEvents]: { type: K; payload: VibeEvents[K] };
}[keyof VibeEvents];

export type { VibeEvents };
