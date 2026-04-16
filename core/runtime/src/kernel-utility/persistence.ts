/**
 * DocPersistence — snapshot read/write for kernel docs (spec 05 §2.1).
 *
 * Lives in the kernel utility process. Persists Loro binary snapshots to
 * `{dataDir}/truffle/{docName}.snapshot`. Periodic saves every 30s when
 * dirty; final save on shutdown.
 */

import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { createScopedLogger } from '../logging/index.js';
import type { KernelDocName, KernelDocs } from '../sync/kernel-docs.js';
import { KERNEL_DOC_NAMES } from '../sync/kernel-docs.js';

const log = createScopedLogger('kernel-utility:persistence');

const SAVE_INTERVAL_MS = 30_000;

export interface DocPersistenceOptions {
  /** Base data directory (e.g. `app.getPath('userData')`). */
  dataDir: string;
}

export class DocPersistence {
  readonly #dataDir: string;
  readonly #dirty = new Set<KernelDocName>();
  #timer: ReturnType<typeof setInterval> | null = null;

  constructor(opts: DocPersistenceOptions) {
    this.#dataDir = opts.dataDir;
  }

  /** Resolve the snapshot file path for a doc. */
  #snapshotPath(docName: KernelDocName): string {
    // Sanitise the doc name for the filesystem (replace / with _).
    const safeName = docName.replace(/\//g, '_');
    return join(this.#dataDir, 'truffle', `${safeName}.snapshot`);
  }

  /** Save a single doc's snapshot to disk. */
  async save(docName: KernelDocName, snapshot: Uint8Array): Promise<void> {
    const path = this.#snapshotPath(docName);
    await mkdir(dirname(path), { recursive: true });
    await writeFile(path, snapshot);
    this.#dirty.delete(docName);
    log.debug({ docName, bytes: snapshot.byteLength }, 'snapshot saved');
  }

  /** Load a single doc's snapshot from disk. Returns null if not found. */
  async load(docName: KernelDocName): Promise<Uint8Array | null> {
    const path = this.#snapshotPath(docName);
    try {
      const buf = await readFile(path);
      log.debug({ docName, bytes: buf.byteLength }, 'snapshot loaded');
      return new Uint8Array(buf);
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code === 'ENOENT') {
        return null;
      }
      throw err;
    }
  }

  /** Save all four kernel doc snapshots. */
  async saveAll(docs: KernelDocs): Promise<void> {
    const tasks = KERNEL_DOC_NAMES.map(async (name) => {
      const snapshot = docs.exportSnapshot(name);
      await this.save(name, snapshot);
    });
    await Promise.all(tasks);
  }

  /** Load and import all saved snapshots into the docs. */
  async loadAll(docs: KernelDocs): Promise<void> {
    const tasks = KERNEL_DOC_NAMES.map(async (name) => {
      const data = await this.load(name);
      if (data) {
        docs.importSnapshot(name, data);
        log.info({ docName: name }, 'restored snapshot');
      }
    });
    await Promise.all(tasks);
  }

  /** Mark a doc as dirty. The periodic timer will save it. */
  markDirty(docName: KernelDocName): void {
    this.#dirty.add(docName);
  }

  /**
   * Start the periodic save timer. Saves dirty docs every 30s.
   * Pass the KernelDocs instance that owns the authoritative replicas.
   */
  startPeriodicSave(docs: KernelDocs): void {
    if (this.#timer) return;
    this.#timer = setInterval(() => {
      if (this.#dirty.size === 0) return;
      const dirtyNames = [...this.#dirty];
      const tasks = dirtyNames.map(async (name) => {
        try {
          const snapshot = docs.exportSnapshot(name);
          await this.save(name, snapshot);
        } catch (err) {
          log.warn({ err: String(err), docName: name }, 'periodic save failed');
        }
      });
      void Promise.all(tasks);
    }, SAVE_INTERVAL_MS);
  }

  /** Stop the periodic save timer. */
  stopPeriodicSave(): void {
    if (this.#timer) {
      clearInterval(this.#timer);
      this.#timer = null;
    }
  }
}
