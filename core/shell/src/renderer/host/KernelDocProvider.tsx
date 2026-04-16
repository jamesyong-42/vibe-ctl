/**
 * KernelDocProvider — renderer-side local replicas of kernel docs (spec 05 §2.1).
 *
 * Receives the doc-sync MessagePort from the handshake (via HostBridgeProvider).
 * On mount, sends 'request-snapshot' for each kernel doc. Receives snapshots
 * and initialises local in-memory replicas. Subscribes to incoming deltas on
 * the port and applies them to local replicas.
 *
 * On local edit: sends delta to kernel utility via the port. This is the
 * renderer's only write path to kernel docs.
 */

import type { DocSyncMessage, KernelDocName } from '@vibe-ctl/runtime';
import { createContext, type FC, type ReactNode, useContext, useEffect, useRef } from 'react';
import { useHostBridgeOptional } from './useHostInvoke.js';

// ─── In-memory doc replica ───────────────────────────────────────────────────

type Listener = () => void;

interface DocReplica {
  readonly name: KernelDocName;
  /** In-memory key-value store for CrdtDoc-style docs. */
  data: Map<string, unknown>;
  /** Snapshot received and applied. */
  ready: boolean;
  /** Subscribers notified on any change. */
  listeners: Set<Listener>;
}

interface KernelDocStore {
  getDoc(name: KernelDocName): DocReplica;
  subscribe(name: KernelDocName, cb: Listener): () => void;
  /** Snapshot of the current version counter (incremented on every change). */
  getVersion(name: KernelDocName): number;
}

const KERNEL_DOC_NAMES: KernelDocName[] = [
  'kernel/plugin-inventory',
  'kernel/canvas-layout',
  'kernel/user-settings',
  'kernel/permissions',
];

function createKernelDocStore(): KernelDocStore & {
  apply(msg: DocSyncMessage): void;
  versions: Map<KernelDocName, number>;
} {
  const docs = new Map<KernelDocName, DocReplica>();
  const versions = new Map<KernelDocName, number>();

  for (const name of KERNEL_DOC_NAMES) {
    docs.set(name, { name, data: new Map(), ready: false, listeners: new Set() });
    versions.set(name, 0);
  }

  function getDoc(name: KernelDocName): DocReplica {
    const doc = docs.get(name);
    if (!doc) throw new Error(`Unknown kernel doc: ${name}`);
    return doc;
  }

  function notify(name: KernelDocName): void {
    versions.set(name, (versions.get(name) ?? 0) + 1);
    const doc = getDoc(name);
    for (const cb of doc.listeners) cb();
  }

  return {
    getDoc,
    subscribe(name, cb) {
      const doc = getDoc(name);
      doc.listeners.add(cb);
      return () => {
        doc.listeners.delete(cb);
      };
    },
    getVersion(name) {
      return versions.get(name) ?? 0;
    },
    versions,
    apply(msg) {
      const doc = getDoc(msg.docName as KernelDocName);

      if (msg.type === 'snapshot') {
        try {
          const text = new TextDecoder().decode(msg.payload);
          const obj = JSON.parse(text) as Record<string, unknown>;
          doc.data.clear();
          for (const [k, v] of Object.entries(obj)) doc.data.set(k, v);
          doc.ready = true;
        } catch {
          // Malformed snapshot
        }
        notify(msg.docName as KernelDocName);
        return;
      }

      if (msg.type === 'delta') {
        try {
          const text = new TextDecoder().decode(msg.payload);
          const parsed = JSON.parse(text) as {
            op?: string;
            key?: string;
            value?: unknown;
            deviceId?: string;
          };
          if (parsed.op === 'set' && parsed.key) {
            doc.data.set(parsed.key, parsed.value);
          } else if (parsed.op === 'delete' && parsed.key) {
            doc.data.delete(parsed.key);
          } else if (parsed.deviceId !== undefined) {
            // SyncedStore delta format
            doc.data.set(parsed.deviceId, parsed.value);
          }
        } catch {
          // Malformed delta
        }
        notify(msg.docName as KernelDocName);
      }
    },
  };
}

// ─── Context ─────────────────────────────────────────────────────────────────

const KernelDocContext = createContext<KernelDocStore | null>(null);

export const KernelDocProvider: FC<{ children: ReactNode }> = ({ children }) => {
  const bridge = useHostBridgeOptional();
  const storeRef = useRef<ReturnType<typeof createKernelDocStore> | null>(null);
  if (!storeRef.current) storeRef.current = createKernelDocStore();
  const store = storeRef.current;

  useEffect(() => {
    if (!bridge) return;
    const port = bridge.docSyncPort;

    const onMessage = (ev: MessageEvent): void => {
      const msg = ev.data as DocSyncMessage | null;
      if (!msg || typeof msg !== 'object' || !('type' in msg)) return;
      store.apply(msg);
    };

    port.addEventListener('message', onMessage);
    port.start();

    // Request snapshots for all four kernel docs.
    for (const name of KERNEL_DOC_NAMES) {
      const req: DocSyncMessage = {
        type: 'request-snapshot',
        docName: name,
        payload: new Uint8Array(0),
      };
      port.postMessage(req);
    }

    return () => {
      port.removeEventListener('message', onMessage);
    };
  }, [bridge, store]);

  return <KernelDocContext.Provider value={store}>{children}</KernelDocContext.Provider>;
};

/**
 * Access the kernel doc store. Throws if used outside KernelDocProvider.
 */
export function useKernelDocStore(): KernelDocStore {
  const store = useContext(KernelDocContext);
  if (!store) throw new Error('useKernelDocStore: KernelDocProvider not mounted');
  return store;
}

/**
 * Optional access — returns null if the provider hasn't mounted.
 */
export function useKernelDocStoreOptional(): KernelDocStore | null {
  return useContext(KernelDocContext);
}
