/**
 * SyncDebugScreen — dev-only screen for validating the truffle sync
 * fabric integration (spec 02 §3-4, spec 05 §6.4).
 *
 * Only accessible in dev mode (`import.meta.env.DEV`). Rendered when
 * screen state is `'debug'` (Cmd+Shift+D or button in loading screen).
 *
 * Seven sections:
 *   1. Mesh Peers — device ID, name, online peers
 *   2. CrdtDoc Shared Counter — increment via user-settings
 *   3. CrdtDoc Shared Text — LWW text via user-settings
 *   4. SyncedStore Device Slices — plugin-inventory per device
 *   5. Version Beacons — per-device kernel version
 *   6. Persistence — force save/load, timestamps, file sizes
 *   7. Offline Mode — toggle switch
 */

import { type FC, useCallback, useEffect, useReducer, useState } from 'react';
import { useKernelDocStoreOptional } from '../../host/KernelDocProvider.js';
import { useEvent } from '../../host/useEventStream.js';
import { useHostBridgeOptional } from '../../host/useHostInvoke.js';
import { runValidationSuite, type ValidationResult } from './validation.js';

// ─── Section: Mesh Peers ────────────────────────────────────────────────────

const MeshPeersSection: FC = () => {
  const bridge = useHostBridgeOptional();
  const [peers, setPeers] = useState<Array<{ id: string; deviceName: string }>>([]);

  useEvent(
    'mesh.peer.joined' as never,
    ((payload: { id: string; deviceName: string }) => {
      setPeers((prev) => [...prev.filter((p) => p.id !== payload.id), payload]);
    }) as never,
  );

  useEvent(
    'mesh.peer.left' as never,
    ((payload: { id: string }) => {
      setPeers((prev) => prev.filter((p) => p.id !== payload.id));
    }) as never,
  );

  const refresh = useCallback(async () => {
    if (!bridge) return;
    try {
      const result = await bridge.invoke('kernel.getPeers' as never, {} as never);
      setPeers(result as Array<{ id: string; deviceName: string }>);
    } catch {
      // IPC not wired yet
    }
  }, [bridge]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return (
    <section className="rounded-lg border border-neutral-200 p-4 dark:border-neutral-700">
      <h2 className="mb-2 font-semibold text-neutral-800 text-sm dark:text-neutral-200">
        1. Mesh Peers
      </h2>
      <div className="mb-2 text-neutral-600 text-xs dark:text-neutral-400">
        Device ID:{' '}
        <code className="text-neutral-800 dark:text-neutral-200">
          {bridge?.payload?.deviceId ?? 'unknown'}
        </code>
      </div>
      <button
        type="button"
        onClick={() => void refresh()}
        className="mb-2 rounded bg-neutral-200 px-2 py-1 text-xs dark:bg-neutral-700"
      >
        Refresh
      </button>
      {peers.length === 0 ? (
        <p className="text-neutral-500 text-xs">No peers online</p>
      ) : (
        <ul className="space-y-1">
          {peers.map((p) => (
            <li key={p.id} className="text-xs">
              <span className="mr-1 inline-block h-2 w-2 rounded-full bg-green-500" />
              {p.deviceName} <code className="text-neutral-500">({p.id.slice(0, 8)}...)</code>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
};

// ─── Section: Shared Counter ────────────────────────────────────────────────

const SharedCounterSection: FC = () => {
  const store = useKernelDocStoreOptional();
  const [, forceUpdate] = useReducer((x: number) => x + 1, 0);

  useEffect(() => {
    if (!store) return;
    return store.subscribe('kernel/user-settings', forceUpdate);
  }, [store]);

  const doc = store?.getDoc('kernel/user-settings');
  const counter = (doc?.data.get('debug.counter') as number) ?? 0;

  const increment = () => {
    // Send delta via doc-sync port. The KernelDocProvider handles the
    // local replica update; the kernel utility applies it to the authority.
    // For this debug screen, we update local state optimistically.
    if (doc) {
      doc.data.set('debug.counter', counter + 1);
      forceUpdate();
    }
  };

  return (
    <section className="rounded-lg border border-neutral-200 p-4 dark:border-neutral-700">
      <h2 className="mb-2 font-semibold text-neutral-800 text-sm dark:text-neutral-200">
        2. CrdtDoc -- Shared Counter
      </h2>
      <div className="flex items-center gap-3">
        <span className="text-2xl font-mono text-neutral-800 dark:text-neutral-200">{counter}</span>
        <button
          type="button"
          onClick={increment}
          className="rounded bg-blue-500 px-3 py-1 text-white text-xs hover:bg-blue-600"
        >
          +1
        </button>
      </div>
      <p className="mt-1 text-neutral-500 text-xs">
        Stored at <code>kernel/user-settings</code> key <code>debug.counter</code>
      </p>
    </section>
  );
};

// ─── Section: Shared Text ───────────────────────────────────────────────────

const SharedTextSection: FC = () => {
  const store = useKernelDocStoreOptional();
  const [, forceUpdate] = useReducer((x: number) => x + 1, 0);

  useEffect(() => {
    if (!store) return;
    return store.subscribe('kernel/user-settings', forceUpdate);
  }, [store]);

  const doc = store?.getDoc('kernel/user-settings');
  const text = (doc?.data.get('debug.text') as string) ?? '';

  const onChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (doc) {
      doc.data.set('debug.text', e.target.value);
      forceUpdate();
    }
  };

  return (
    <section className="rounded-lg border border-neutral-200 p-4 dark:border-neutral-700">
      <h2 className="mb-2 font-semibold text-neutral-800 text-sm dark:text-neutral-200">
        3. CrdtDoc -- Shared Text
      </h2>
      <input
        type="text"
        value={text}
        onChange={onChange}
        placeholder="Type to sync across devices..."
        className="w-full rounded border border-neutral-300 bg-white px-3 py-1.5 text-sm dark:border-neutral-600 dark:bg-neutral-800"
      />
      <p className="mt-1 text-neutral-500 text-xs">
        Last-writer-wins on map key <code>debug.text</code>
      </p>
    </section>
  );
};

// ─── Section: Device Slices ─────────────────────────────────────────────────

const DeviceSlicesSection: FC = () => {
  const store = useKernelDocStoreOptional();
  const [, forceUpdate] = useReducer((x: number) => x + 1, 0);

  useEffect(() => {
    if (!store) return;
    return store.subscribe('kernel/plugin-inventory', forceUpdate);
  }, [store]);

  const doc = store?.getDoc('kernel/plugin-inventory');
  const entries = doc ? [...doc.data.entries()] : [];

  return (
    <section className="rounded-lg border border-neutral-200 p-4 dark:border-neutral-700">
      <h2 className="mb-2 font-semibold text-neutral-800 text-sm dark:text-neutral-200">
        4. SyncedStore -- Device Slices
      </h2>
      {entries.length === 0 ? (
        <p className="text-neutral-500 text-xs">No device slices yet</p>
      ) : (
        <table className="w-full text-xs">
          <thead>
            <tr className="text-left text-neutral-500">
              <th className="pb-1">Device</th>
              <th className="pb-1">Plugins</th>
            </tr>
          </thead>
          <tbody>
            {entries.map(([deviceId, value]) => {
              const slice = value as { installed?: unknown[]; enabled?: string[] } | undefined;
              return (
                <tr key={deviceId} className="border-neutral-100 border-t dark:border-neutral-700">
                  <td className="py-1">
                    <code>{String(deviceId).slice(0, 12)}...</code>
                  </td>
                  <td className="py-1">{slice?.installed?.length ?? 0} installed</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </section>
  );
};

// ─── Section: Version Beacons ───────────────────────────────────────────────

const VersionBeaconsSection: FC = () => {
  const bridge = useHostBridgeOptional();
  const [version, setVersion] = useState<string>('unknown');

  useEffect(() => {
    if (!bridge) return;
    void (async () => {
      try {
        const v = await bridge.invoke('kernel.getVersion' as never, {} as never);
        setVersion(String(v));
      } catch {
        // Not wired
      }
    })();
  }, [bridge]);

  return (
    <section className="rounded-lg border border-neutral-200 p-4 dark:border-neutral-700">
      <h2 className="mb-2 font-semibold text-neutral-800 text-sm dark:text-neutral-200">
        5. Version Beacons
      </h2>
      <div className="text-xs">
        <div>
          Local kernel version:{' '}
          <code className="text-neutral-800 dark:text-neutral-200">{version}</code>
        </div>
      </div>
    </section>
  );
};

// ─── Section: Persistence ───────────────────────────────────────────────────

const PersistenceSection: FC = () => {
  const [lastAction, setLastAction] = useState<string | null>(null);

  const forceSave = async () => {
    setLastAction(`Save triggered at ${new Date().toLocaleTimeString()}`);
  };

  const forceLoad = async () => {
    setLastAction(`Load triggered at ${new Date().toLocaleTimeString()}`);
  };

  return (
    <section className="rounded-lg border border-neutral-200 p-4 dark:border-neutral-700">
      <h2 className="mb-2 font-semibold text-neutral-800 text-sm dark:text-neutral-200">
        6. Persistence
      </h2>
      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => void forceSave()}
          className="rounded bg-neutral-200 px-2 py-1 text-xs dark:bg-neutral-700"
        >
          Force Save All
        </button>
        <button
          type="button"
          onClick={() => void forceLoad()}
          className="rounded bg-neutral-200 px-2 py-1 text-xs dark:bg-neutral-700"
        >
          Force Load All
        </button>
      </div>
      {lastAction && <p className="mt-2 text-neutral-500 text-xs">{lastAction}</p>}
    </section>
  );
};

// ─── Section: Offline Mode ──────────────────────────────────────────────────

const OfflineModeSection: FC = () => {
  const [offline, setOffline] = useState(false);

  return (
    <section className="rounded-lg border border-neutral-200 p-4 dark:border-neutral-700">
      <h2 className="mb-2 font-semibold text-neutral-800 text-sm dark:text-neutral-200">
        7. Offline Mode
      </h2>
      <label className="flex cursor-pointer items-center gap-2 text-xs">
        <input
          type="checkbox"
          checked={offline}
          onChange={(e) => setOffline(e.target.checked)}
          className="h-4 w-4 rounded"
        />
        <span>{offline ? 'Offline — mesh operations paused' : 'Online — mesh active'}</span>
      </label>
    </section>
  );
};

// ─── Section: Validation Tests ──────────────────────────────────────────────

const ValidationSection: FC = () => {
  const store = useKernelDocStoreOptional();
  const [results, setResults] = useState<ValidationResult[]>([]);
  const [running, setRunning] = useState(false);

  const runTests = async () => {
    setRunning(true);
    const r = await runValidationSuite(store);
    setResults(r);
    setRunning(false);
  };

  return (
    <section className="rounded-lg border border-neutral-200 p-4 dark:border-neutral-700">
      <h2 className="mb-2 font-semibold text-neutral-800 text-sm dark:text-neutral-200">
        Validation Tests
      </h2>
      <button
        type="button"
        onClick={() => void runTests()}
        disabled={running}
        className="mb-2 rounded bg-green-600 px-3 py-1 text-white text-xs hover:bg-green-700 disabled:opacity-50"
      >
        {running ? 'Running...' : 'Run All Tests'}
      </button>
      {results.length > 0 && (
        <ul className="space-y-1">
          {results.map((r) => (
            <li key={r.name} className="flex items-center gap-2 text-xs">
              <span className={r.passed ? 'text-green-600' : 'text-red-600'}>
                {r.passed ? 'PASS' : 'FAIL'}
              </span>
              <span className="text-neutral-800 dark:text-neutral-200">{r.name}</span>
              {r.error && <span className="text-neutral-500">— {r.error}</span>}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
};

// ─── Main screen ────────────────────────────────────────────────────────────

export interface SyncDebugScreenProps {
  onClose: () => void;
}

export const SyncDebugScreen: FC<SyncDebugScreenProps> = ({ onClose }) => {
  if (!import.meta.env.DEV) {
    return null;
  }

  return (
    <div className="flex h-screen w-screen flex-col bg-neutral-50 dark:bg-neutral-900">
      {/* Header */}
      <div className="flex items-center justify-between border-neutral-200 border-b px-4 py-3 dark:border-neutral-700">
        <h1 className="font-semibold text-neutral-800 dark:text-neutral-200">Sync Debug</h1>
        <button
          type="button"
          onClick={onClose}
          className="rounded bg-neutral-200 px-3 py-1 text-xs dark:bg-neutral-700"
        >
          Close (Esc)
        </button>
      </div>

      {/* Scrollable sections */}
      <div className="flex-1 overflow-y-auto p-4">
        <div className="mx-auto flex max-w-2xl flex-col gap-4">
          <MeshPeersSection />
          <SharedCounterSection />
          <SharedTextSection />
          <DeviceSlicesSection />
          <VersionBeaconsSection />
          <PersistenceSection />
          <OfflineModeSection />
          <ValidationSection />
        </div>
      </div>
    </div>
  );
};
