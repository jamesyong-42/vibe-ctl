/**
 * DocRouter — per-renderer port fanout for kernel doc deltas (spec 05 §6.4).
 *
 * Lives in the kernel utility process. Manages a set of renderer ports
 * (each a MessagePort received from main via transfer). When a renderer
 * sends a delta, it's applied to the DocAuthority and fanned out to
 * other renderers + peers. When DocAuthority produces a delta (from a
 * peer or another renderer), it's fanned out to all subscribed renderer
 * ports.
 *
 * Also handles 'request-snapshot' messages: responds with the full
 * snapshot for that doc so the renderer can initialise its local replica.
 */

import type { DocSyncMessage } from '../ipc/doc-sync.js';
import { createScopedLogger } from '../logging/index.js';
import type { DocAuthority } from '../sync/doc-authority.js';
import { KERNEL_DOC_NAMES, type KernelDocName } from '../sync/kernel-docs.js';

const log = createScopedLogger('kernel-utility:doc-router');

/**
 * Structural interface for a MessagePort in the kernel utility process.
 * Matches both Node `MessagePort` and Electron `MessagePortMain`.
 */
export interface DocSyncPort {
  on(event: 'message', listener: (ev: { data: unknown }) => void): void;
  // biome-ignore lint/suspicious/noExplicitAny: must accept any listener shape for removal
  off?(event: 'message', listener: (...args: any[]) => void): void;
  // biome-ignore lint/suspicious/noExplicitAny: must accept any listener shape for removal
  removeListener?(event: 'message', listener: (...args: any[]) => void): void;
  postMessage(msg: unknown, transfer?: unknown[]): void;
  start?(): void;
  close?(): void;
}

export interface DocRouterOptions {
  authority: DocAuthority;
}

export class DocRouter {
  readonly #authority: DocAuthority;
  readonly #ports = new Set<DocSyncPort>();
  readonly #portListeners = new Map<DocSyncPort, (ev: { data: unknown }) => void>();

  constructor(opts: DocRouterOptions) {
    this.#authority = opts.authority;
  }

  /**
   * Add a renderer's doc-sync port. Subscribe to incoming messages from
   * that renderer and add it to the fanout list.
   */
  addRenderer(port: DocSyncPort): void {
    this.#ports.add(port);
    port.start?.();

    const listener = (ev: { data: unknown }): void => {
      const msg = ev.data as DocSyncMessage | null;
      if (!msg || typeof msg !== 'object' || !('type' in msg)) return;

      const docName = msg.docName as KernelDocName;
      if (!isKernelDocName(docName)) {
        log.warn({ docName }, 'received delta for unknown doc');
        return;
      }

      if (msg.type === 'request-snapshot') {
        this.#sendSnapshot(port, docName);
        return;
      }

      if (msg.type === 'delta') {
        // Apply to authority; it fans out to other renderers + peers.
        // Pass the port as the source so DocAuthority can exclude it from
        // the broadcast (echo suppression).
        this.#authority.applyDelta(
          docName,
          msg.payload,
          port as unknown as import('../sync/doc-authority.js').RendererPort,
        );
        return;
      }
    };

    port.on('message', listener);
    this.#portListeners.set(port, listener);

    // Register the port with the authority for each kernel doc so it
    // receives peer-originated deltas.
    for (const name of KERNEL_DOC_NAMES) {
      this.#authority.addRendererPort(
        name,
        port as unknown as import('../sync/doc-authority.js').RendererPort,
      );
    }

    log.info('renderer port added to doc-router');
  }

  /** Remove a renderer port from the router and clean up. */
  removeRenderer(port: DocSyncPort): void {
    this.#ports.delete(port);

    const listener = this.#portListeners.get(port);
    if (listener) {
      if (port.off) {
        port.off('message', listener);
      } else if (port.removeListener) {
        port.removeListener('message', listener as (...args: unknown[]) => void);
      }
      this.#portListeners.delete(port);
    }

    this.#authority.removeRendererPortAll(
      port as unknown as import('../sync/doc-authority.js').RendererPort,
    );

    port.close?.();
    log.info('renderer port removed from doc-router');
  }

  /** Remove all renderer ports. */
  removeAll(): void {
    for (const port of [...this.#ports]) {
      this.removeRenderer(port);
    }
  }

  /** Send a full snapshot for a doc to a specific port. */
  #sendSnapshot(port: DocSyncPort, docName: KernelDocName): void {
    const snapshot = this.#authority.docs.exportSnapshot(docName);
    const msg: DocSyncMessage = { type: 'snapshot', docName, payload: snapshot };
    try {
      port.postMessage(msg);
      log.debug({ docName, bytes: snapshot.byteLength }, 'sent snapshot to renderer');
    } catch (err) {
      log.warn({ err: String(err), docName }, 'failed to send snapshot');
    }
  }

  get rendererCount(): number {
    return this.#ports.size;
  }
}

function isKernelDocName(name: string): name is KernelDocName {
  return (KERNEL_DOC_NAMES as readonly string[]).includes(name);
}
