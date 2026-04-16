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
import { DocRouter, type DocSyncPort } from './doc-router.js';
import { type EventSink, createEventSink } from './event-sink.js';
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
  docRouter: DocRouter;
  truffleAvailable: boolean;
}

let syncStack: SyncStack | null = null;

// --- Boot sync stack -----------------------------------------------------

async function bootSyncStack(eventSink: EventSink): Promise<SyncStack> {
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
        log.info({ url }, 'tailscale auth required — dispatching event');
        eventSink.emit('mesh.auth.required', { url });
      });
      await napiNode.start({
        appId: APP_ID,
        deviceName,
        deviceId,
        sidecarPath,
        stateDir: `${dataDir}/truffle/${APP_ID}`,
      });
      log.info({ deviceId, deviceName }, 'NapiNode started');

      // Emit mesh.auth.completed on the first peer join (or if peers
      // are already present). Once fired, no further `completed` events
      // are emitted in this process lifetime — repeats would churn the
      // onboarding UI.
      let authCompleted = false;
      const markCompleted = (): void => {
        if (authCompleted) return;
        authCompleted = true;
        eventSink.emit('mesh.auth.completed', undefined);
        log.info('mesh auth completed — first peer observed');
      };
      napiNode.onPeerChange((event) => {
        if (event.eventType === 'joined') markCompleted();
      });
      // Catch already-connected peers (e.g. on a fast rejoin).
      try {
        const peers = await napiNode.getPeers();
        if (peers.length > 0) markCompleted();
      } catch (err) {
        log.debug({ err: String(err) }, 'initial getPeers() after start failed');
      }
    } catch (err) {
      const reason = err instanceof Error ? err.message : String(err);
      log.error({ err: reason }, 'failed to start NapiNode — falling back to offline');
      eventSink.emit('mesh.auth.failed', { reason });
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

  // 9. DocRouter — per-renderer port fanout. addRenderer() is called as
  //    each window's doc-sync port arrives over parentPort (see main()).
  const docRouter = new DocRouter({ authority });

  // When any doc changes (local commit or peer sync), fan out to all
  // subscribed renderer ports. For truffle-backed docs the adapter emits
  // the full current state on onChange (truffle's NAPI doesn't expose a
  // frontier-based delta export), so we broadcast as 'snapshot' —
  // renderers replace their replica wholesale. For in-memory fallback
  // docs the payload is a compact JSON op, so we broadcast as 'delta'.
  for (const name of KERNEL_DOC_NAMES) {
    docs.getDoc(name).subscribe((payload) => {
      if (docs.isTruffleBacked) {
        authority.broadcastSnapshotToRenderers(name, payload);
      } else {
        authority.broadcastToRenderers(name, payload);
      }
    });
  }

  return {
    meshNode,
    docs,
    authority,
    persistence,
    versionBeacons,
    docRouter,
    truffleAvailable,
  };
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

  // Event sink: kernel-utility → main (→ renderer) event stream. Buffers
  // until main attaches via ctrlService.onEvent(cb) over Comlink.
  const eventSink = createEventSink();

  // Boot the sync stack asynchronously.
  const bootPromise = bootSyncStack(eventSink)
    .then((stack) => {
      syncStack = stack;
      log.info({ truffleAvailable: stack.truffleAvailable }, 'sync stack booted');
    })
    .catch((err) => {
      log.error({ err: String(err) }, 'sync stack boot failed');
    });

  onShutdown(async () => {
    if (!syncStack) return;
    const { persistence, docs, meshNode, docRouter } = syncStack;

    // 1. Disconnect renderer ports.
    docRouter.removeAll();

    // 2. Stop periodic saves.
    persistence.stopPeriodicSave();

    // 3. Final save.
    try {
      await persistence.saveAll(docs);
      log.info('final snapshot save complete');
    } catch (err) {
      log.error({ err: String(err) }, 'final snapshot save failed');
    }

    // 4. Close docs.
    await docs.close();

    // 5. Stop mesh node.
    await meshNode.stop();
    log.info('sync stack shut down');
  });

  // Main transfers ports over parentPort in several messages:
  //   1. First message (data=null) carries the ctrl port.
  //   2. Each subsequent { type: 'doc-sync-port' } message carries one
  //      renderer's doc-sync port end.
  //   3. { type: 'shutdown' } is handled by onShutdown() above.
  //
  // The listener stays registered for the utility's lifetime so windows
  // created after boot still have their doc-sync ports brokered.
  let ctrlWired = false;
  const onParentMessage = (ev: { data: unknown; ports?: unknown[] }): void => {
    const ports = ev.ports ?? [];
    const data = ev.data as { type?: string } | null;

    // 1. First message — ctrl port. Arrives with data=null.
    if (!ctrlWired) {
      if (ports.length === 0) {
        log.warn({ msg: ev.data }, 'first parentPort message had no ports — ignoring');
        return;
      }
      const ctrlPort = ports[0] as NodeMessagePort | undefined;
      if (!ctrlPort) return;
      ctrlPort.start?.();
      Comlink.expose(
        createCtrlService({
          getStack: () => syncStack,
          bootPromise,
          eventSink,
        }),
        nodeEndpoint(ctrlPort),
      );
      ctrlWired = true;
      log.info('ctrl port wired; kernel utility ready');
      return;
    }

    // 2. Subsequent doc-sync-port messages — one port each.
    if (data && typeof data === 'object' && data.type === 'doc-sync-port') {
      const port = ports[0] as DocSyncPort | undefined;
      if (!port) {
        log.warn('doc-sync-port message arrived without a port — ignoring');
        return;
      }
      // Queue the attach until the sync stack boots, then add to the
      // router. If boot fails, drop the port silently (main will notice
      // via supervisor and re-handshake on restart — spec 05 §6.4).
      void bootPromise.then(() => {
        if (!syncStack) return;
        syncStack.docRouter.addRenderer(port);
        log.info({ count: syncStack.docRouter.rendererCount }, 'doc-sync port attached');
      });
      return;
    }
  };
  parentPort.on('message', onParentMessage);
}

main();
