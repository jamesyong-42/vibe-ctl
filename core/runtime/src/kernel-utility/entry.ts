/**
 * Kernel utility process entry (spec 05 §2, §6.4).
 *
 * Spawned by the shell's main process via `utilityProcess.fork(dist/kernel-utility.js)`.
 * The main process transfers a single `MessagePortMain` over
 * `process.parentPort` on startup; this module wires that port to the
 * `KernelCtrl` Comlink service via the shared `nodeEndpoint` adapter
 * in `ipc/comlink-node-adapter.ts`.
 *
 * On boot:
 *   1. Attempt to load truffle via dynamic import.
 *   2. If available, instantiate NapiNode and start it (joins tailnet).
 *   3. Open four kernel docs via NapiNode (or in-memory fallback).
 *   4. Load persisted snapshots into docs.
 *   5. Wire DocAuthority for renderer↔utility delta fan-out.
 *   6. Start periodic persistence.
 *   7. Expose KernelCtrl Comlink service on the ctrl port.
 *
 * On shutdown:
 *   1. Stop periodic persistence.
 *   2. Save all doc snapshots.
 *   3. Close kernel docs.
 *   4. Stop NapiNode.
 */

import * as Comlink from 'comlink';
import type { NodeMessagePort } from '../ipc/comlink-node-adapter.js';
import { nodeEndpoint } from '../ipc/comlink-node-adapter.js';
import { createScopedLogger } from '../logging/index.js';
import { DocAuthority } from '../sync/doc-authority.js';
import { KERNEL_DOC_NAMES, KernelDocs } from '../sync/kernel-docs.js';
import { MeshNode } from '../sync/mesh-node.js';
import { loadTruffle } from '../sync/truffle-types.js';
import { VersionBeacons } from '../sync/version-beacons.js';
import { createCtrlService } from './ctrl-service.js';
import { DocPersistence } from './persistence.js';
import { onShutdown } from './shutdown.js';

const log = createScopedLogger('kernel-utility');

// --- Ambient types we depend on ----------------------------------------
//
// `process.parentPort` only exists inside `utilityProcess.fork`. We avoid
// a hard dep on electron from @vibe-ctl/runtime by declaring a minimal
// ambient surface here.

declare global {
  namespace NodeJS {
    interface Process {
      parentPort?: NodeMessagePort;
    }
  }
}

// --- Constants -----------------------------------------------------------

const APP_ID = 'vibe-ctl';
const KERNEL_VERSION = '0.1.0';
const MIN_KERNEL_VERSION = '0.1.0';

// --- Sync stack state ----------------------------------------------------

interface SyncStack {
  meshNode: MeshNode;
  docs: KernelDocs;
  authority: DocAuthority;
  persistence: DocPersistence;
  versionBeacons: VersionBeacons;
  truffleAvailable: boolean;
}

let syncStack: SyncStack | null = null;

// --- Boot sync stack -----------------------------------------------------

async function bootSyncStack(): Promise<SyncStack> {
  const dataDir = process.env.VIBE_CTL_DATA_DIR ?? process.cwd();
  const deviceId = process.env.VIBE_CTL_DEVICE_ID ?? `dev-${Date.now().toString(36)}`;
  const deviceName = process.env.VIBE_CTL_DEVICE_NAME ?? 'vibe-ctl-dev';

  // 1. Attempt to load truffle.
  const truffle = await loadTruffle();
  const truffleAvailable = truffle !== null;

  if (truffleAvailable) {
    log.info('truffle loaded — wiring real NapiNode sync stack');
  } else {
    log.warn('truffle not available — falling back to in-memory simulation');
  }

  // 2. Create and start NapiNode (if truffle is available).
  let napiNode: InstanceType<NonNullable<typeof truffle>['NapiNode']> | null = null;
  if (truffle) {
    try {
      napiNode = new truffle.NapiNode();
      const sidecarPath = truffle.resolveSidecarPath();
      napiNode.onAuthRequired((url: string) => {
        log.info({ url }, 'tailscale auth required');
      });
      await napiNode.start({
        appId: APP_ID,
        deviceName,
        deviceId,
        sidecarPath,
        stateDir: `${dataDir}/truffle/${APP_ID}`,
      });
      log.info({ deviceId, deviceName }, 'NapiNode started');
    } catch (err) {
      log.error({ err: String(err) }, 'failed to start NapiNode — falling back to offline');
      napiNode = null;
    }
  }

  // 3. Create MeshNode wrapper.
  const meshNode = new MeshNode({
    deviceId,
    deviceName,
    logger: log,
    truffleNode: napiNode ?? undefined,
  });
  await meshNode.start();

  // 4. Open kernel docs (truffle-backed or in-memory fallback).
  let truffleDocs:
    | NonNullable<ConstructorParameters<typeof KernelDocs>[0]['truffleDocs']>
    | undefined;
  if (napiNode) {
    truffleDocs = {
      canvasLayout: napiNode.crdtDoc('kernel/canvas-layout'),
      userSettings: napiNode.crdtDoc('kernel/user-settings'),
      permissions: napiNode.crdtDoc('kernel/permissions'),
      inventory: napiNode.syncedStore('kernel/plugin-inventory'),
    };
  }

  const docs = new KernelDocs({ deviceId, truffleDocs });
  await docs.open();
  log.info({ truffleBacked: docs.isTruffleBacked }, 'kernel docs opened');

  // 5. Version beacons (SyncedStore).
  // Version beacons use the in-memory fallback store for now. When truffle
  // is wired, the MeshNode's SyncedStore handles peer sync; version beacons
  // are a lightweight local-first concern that doesn't need Loro backing.
  const versionBeaconStore = createFallbackVersionBeaconStore(deviceId);
  const versionBeacons = new VersionBeacons(versionBeaconStore);
  versionBeacons.publishVersion(deviceId, KERNEL_VERSION, MIN_KERNEL_VERSION);

  // 6. Load persisted snapshots.
  const persistence = new DocPersistence({ dataDir });
  await persistence.loadAll(docs);

  // 7. Wire DocAuthority.
  const authority = new DocAuthority({ docs, mesh: meshNode });
  authority.subscribeToPeerDeltas();

  // 8. Wire persistence dirty tracking.
  for (const name of KERNEL_DOC_NAMES) {
    docs.getDoc(name).subscribe(() => {
      persistence.markDirty(name);
    });
  }
  persistence.startPeriodicSave(docs);

  return { meshNode, docs, authority, persistence, versionBeacons, truffleAvailable };
}

// --- Fallback version beacon store (in-memory) ---------------------------

function createFallbackVersionBeaconStore(deviceId: string) {
  const slices = new Map<
    string,
    { kernelVersion: string; minKernelVersion: string; publishedAt: number }
  >();
  const listeners = new Set<(delta: Uint8Array) => void>();

  return {
    id: 'kernel/version-beacons',
    get() {
      return slices.get(deviceId);
    },
    set(value: { kernelVersion: string; minKernelVersion: string; publishedAt: number }) {
      slices.set(deviceId, value);
      const delta = new TextEncoder().encode(JSON.stringify({ deviceId, value }));
      for (const cb of listeners) cb(delta);
      return delta;
    },
    all() {
      return new Map(slices);
    },
    subscribe(cb: (delta: Uint8Array) => void) {
      listeners.add(cb);
      return {
        [Symbol.dispose]() {
          listeners.delete(cb);
        },
      };
    },
    applyDelta(delta: Uint8Array) {
      try {
        const text = new TextDecoder().decode(delta);
        const parsed = JSON.parse(text) as {
          deviceId: string;
          value: { kernelVersion: string; minKernelVersion: string; publishedAt: number };
        };
        slices.set(parsed.deviceId, parsed.value);
      } catch {
        /* ignore */
      }
    },
    exportSnapshot() {
      return new TextEncoder().encode(JSON.stringify(Object.fromEntries(slices)));
    },
    importSnapshot(data: Uint8Array) {
      try {
        const text = new TextDecoder().decode(data);
        const obj = JSON.parse(text) as Record<
          string,
          { kernelVersion: string; minKernelVersion: string; publishedAt: number }
        >;
        slices.clear();
        for (const [k, v] of Object.entries(obj)) slices.set(k, v);
      } catch {
        /* ignore */
      }
    },
    async stop() {
      /* no-op */
    },
  };
}

// --- Main ----------------------------------------------------------------

function main(): void {
  const parentPort = process.parentPort;
  if (!parentPort) {
    log.error('kernel-utility started without process.parentPort — aborting');
    process.exit(1);
    return;
  }

  log.info('kernel-utility process started');

  // Boot the sync stack asynchronously.
  const bootPromise = bootSyncStack()
    .then((stack) => {
      syncStack = stack;
      log.info({ truffleAvailable: stack.truffleAvailable }, 'sync stack booted');
    })
    .catch((err) => {
      log.error({ err: String(err) }, 'sync stack boot failed');
    });

  onShutdown(async () => {
    if (!syncStack) return;
    const { persistence, docs, meshNode } = syncStack;

    // 1. Stop periodic saves.
    persistence.stopPeriodicSave();

    // 2. Final save.
    try {
      await persistence.saveAll(docs);
      log.info('final snapshot save complete');
    } catch (err) {
      log.error({ err: String(err) }, 'final snapshot save failed');
    }

    // 3. Close docs.
    await docs.close();

    // 4. Stop mesh node.
    await meshNode.stop();
    log.info('sync stack shut down');
  });

  // Main transfers exactly one MessagePortMain (the ctrl port) on the
  // first parentPort message. Once received, wire Comlink and move on.
  const onFirstMessage = (ev: { data: unknown; ports?: unknown[] }): void => {
    const ports = ev.ports ?? [];
    if (ports.length === 0) {
      log.warn({ msg: ev.data }, 'first parentPort message had no ports — ignoring');
      return;
    }
    parentPort.off?.('message', onFirstMessage);
    const ctrlPort = ports[0] as NodeMessagePort | undefined;
    if (!ctrlPort) return;
    ctrlPort.start?.();
    Comlink.expose(
      createCtrlService({
        getStack: () => syncStack,
        bootPromise,
      }),
      nodeEndpoint(ctrlPort),
    );
    log.info('ctrl port wired; kernel utility ready');
  };
  parentPort.on('message', onFirstMessage);
}

main();
