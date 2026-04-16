/**
 * useKernelDoc — reactive hook over a renderer-local kernel doc replica.
 *
 * Returns a reactive handle that re-renders the component when the doc
 * changes (delta received from the kernel utility). Uses
 * `useSyncExternalStore` for tear-safe subscriptions.
 */

import type { KernelDocName } from '@vibe-ctl/runtime';
import { useSyncExternalStore } from 'react';
import { useKernelDocStore } from './KernelDocProvider.js';

export interface KernelDocHandle {
  /** Read a value from the doc's local replica. */
  get(key: string): unknown;
  /** Get all entries in the doc's local replica. */
  entries(): Array<[string, unknown]>;
  /** Whether the initial snapshot has been received. */
  ready: boolean;
  /** Monotonic version counter — changes on every delta applied. */
  version: number;
}

/**
 * Subscribe to a kernel doc's local replica. Re-renders whenever the
 * doc receives a delta or snapshot from the kernel utility.
 */
export function useKernelDoc(name: KernelDocName): KernelDocHandle {
  const store = useKernelDocStore();

  const version = useSyncExternalStore(
    (listener) => store.subscribe(name, listener),
    () => store.getVersion(name),
    () => 0,
  );

  const doc = store.getDoc(name);

  return {
    get(key: string) {
      return doc.data.get(key);
    },
    entries() {
      return [...doc.data.entries()];
    },
    ready: doc.ready,
    version,
  };
}
