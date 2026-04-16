/**
 * IPC MessagePort broker (spec 05 §6).
 *
 * Mints `MessageChannelMain` pairs on demand and remembers which ports
 * belong to which window. On window close, the recorded ports are
 * closed so nothing leaks.
 *
 * Phase-1 scope: event pair + a (currently empty) per-plugin slot. The
 * doc-sync pair is brokered separately via `brokerDocSyncPort()` so one
 * end ships straight to the kernel utility and main never holds a copy.
 * Phase 6 fills in per-split-plugin RPC.
 */

import { MessageChannelMain, type MessagePortMain } from 'electron';

export interface HandshakePorts {
  /** Main keeps `event.remote`; renderer gets `event.local` via handshake. */
  event: { local: MessagePortMain; remote: MessagePortMain };
  /**
   * Per-split-plugin RPC channels. Empty in Phase 1 — Phase 6 mints one
   * entry per active split plugin at activation time.
   */
  plugins: Record<string, { local: MessagePortMain; remote: MessagePortMain }>;
}

export interface Broker {
  /** Mint a full port bundle for a renderer window handshake. */
  mintForWindow(windowId: number): HandshakePorts;
  /** Close every port tracked for `windowId`. Called on window close. */
  releaseWindow(windowId: number): void;
}

function pair(): { local: MessagePortMain; remote: MessagePortMain } {
  const { port1, port2 } = new MessageChannelMain();
  return { local: port1, remote: port2 };
}

export function createBroker(): Broker {
  const tracked = new Map<number, HandshakePorts>();

  return {
    mintForWindow(windowId) {
      const existing = tracked.get(windowId);
      if (existing) return existing;
      const ports: HandshakePorts = {
        event: pair(),
        plugins: {},
      };
      tracked.set(windowId, ports);
      return ports;
    },
    releaseWindow(windowId) {
      const ports = tracked.get(windowId);
      if (!ports) return;
      tracked.delete(windowId);
      const closeAll = [
        ports.event.local,
        ports.event.remote,
        ...Object.values(ports.plugins).flatMap((p) => [p.local, p.remote]),
      ];
      for (const port of closeAll) {
        try {
          port.close();
        } catch {
          // ignore double-close
        }
      }
    },
  };
}
