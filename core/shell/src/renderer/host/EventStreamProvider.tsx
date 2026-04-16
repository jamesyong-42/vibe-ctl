/**
 * EventStreamProvider — binds the kernel event port to React (spec 05 §6.2).
 *
 * Subscribes to `eventPort.onmessage` and keeps a last-seen-payload-per-
 * type map. Phase 1 is happy with "last event wins" — the full fanout
 * with per-listener queues lands once consumers arrive in Phase 3.
 *
 * Intentionally hand-rolled with `useSyncExternalStore` rather than a
 * Zustand dep: the plan's Zustand mention is aspirational, and staying
 * dep-free keeps the renderer bundle slim.
 */

import type { VibeEvents } from '@vibe-ctl/runtime';
import {
  createContext,
  type FC,
  type ReactNode,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useSyncExternalStore,
} from 'react';
import { useHostBridgeOptional } from './useHostInvoke.js';

type EventMap = { [K in keyof VibeEvents]?: VibeEvents[K] };

interface EventStore {
  get<E extends keyof VibeEvents>(type: E): VibeEvents[E] | undefined;
  subscribe(listener: () => void): () => void;
  /** Called by the provider on each incoming message. */
  push<E extends keyof VibeEvents>(type: E, payload: VibeEvents[E]): void;
}

function createEventStore(): EventStore {
  let state: EventMap = {};
  const listeners = new Set<() => void>();
  return {
    get(type) {
      return state[type] as VibeEvents[typeof type] | undefined;
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    push(type, payload) {
      state = { ...state, [type]: payload };
      for (const listener of listeners) listener();
    },
  };
}

const EventStoreContext = createContext<EventStore | null>(null);

export const EventStreamProvider: FC<{ children: ReactNode }> = ({ children }) => {
  const bridge = useHostBridgeOptional();
  const storeRef = useRef<EventStore | null>(null);
  if (!storeRef.current) storeRef.current = createEventStore();
  const store = storeRef.current;

  useEffect(() => {
    if (!bridge) return;
    const port = bridge.eventPort;
    const onMessage = (ev: MessageEvent): void => {
      const data = ev.data as {
        type: keyof VibeEvents;
        payload: VibeEvents[keyof VibeEvents];
      } | null;
      if (!data || typeof data !== 'object' || !('type' in data)) return;
      store.push(data.type, data.payload);
    };
    port.addEventListener('message', onMessage);
    port.start();
    return () => {
      port.removeEventListener('message', onMessage);
    };
  }, [bridge, store]);

  const value = useMemo(() => store, [store]);
  return <EventStoreContext.Provider value={value}>{children}</EventStoreContext.Provider>;
};

export function useEventStore(): EventStore {
  const store = useContext(EventStoreContext);
  if (!store) throw new Error('useEventStore: EventStreamProvider not mounted');
  return store;
}

/**
 * Read the last-seen payload for an event type. Subscribes for
 * re-render on subsequent deliveries.
 */
export function useEventSnapshot<E extends keyof VibeEvents>(type: E): VibeEvents[E] | undefined {
  const store = useEventStore();
  return useSyncExternalStore(
    (listener) => store.subscribe(listener),
    () => store.get(type),
    () => undefined,
  );
}
