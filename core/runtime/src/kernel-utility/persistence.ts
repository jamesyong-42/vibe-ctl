/**
 * DocPersistence — snapshot read/write for kernel docs (spec 05 §2.1).
 *
 * Lives in the kernel utility process. Persists Loro-shaped binary
 * snapshots to `{dataDir}/truffle/{docName}.loro`. The payload comes
 * from `CrdtDocHandle.exportSnapshot()`: when truffle exposes a binary
 * export path at NAPI level these are raw Loro bytes; today they are
 * UTF-8 JSON bytes emitted by the adapter. Writes and reads treat the
 * payload as opaque `Uint8Array`.
 *
 * Migration: prior builds wrote `.snapshot` files (JSON). On load we
 * fall back to `.snapshot` if `.loro` is absent, import it into the
 * doc, and write out the new `.loro` file on the next save cycle.
 *
 * Periodic saves every 30s when dirty; final save on shutdown.
 */

import { mkdir, readFile, rename, stat, unlink, writeFile } from 'node:fs/promises';
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

/** Snapshot metadata returned for debug UI. */
export interface SnapshotInfo {
  docName: KernelDocName;
  path: string;
  bytes: number;
  lastSavedAt: number | null;
}

export class DocPersistence {
  readonly #dataDir: string;
  readonly #dirty = new Set<KernelDocName>();
  readonly #lastSavedAt = new Map<KernelDocName, number>();
  #timer: ReturnType<typeof setInterval> | null = null;

  constructor(opts: DocPersistenceOptions) {
    this.#dataDir = opts.dataDir;
  }

  /** Resolve the current (.loro) snapshot file path for a doc. */
  #snapshotPath(docName: KernelDocName): string {
    // Sanitise the doc name for the filesystem (replace / with _).
    const safeName = docName.replace(/\//g, '_');
    return join(this.#dataDir, 'truffle', `${safeName}.loro`);
  }

  /** Resolve the legacy (.snapshot) file path for migration. */
  #legacySnapshotPath(docName: KernelDocName): string {
    const safeName = docName.replace(/\//g, '_');
    return join(this.#dataDir, 'truffle', `${safeName}.snapshot`);
  }

  /** Save a single doc's snapshot to disk. */
  async save(docName: KernelDocName, snapshot: Uint8Array): Promise<void> {
    const path = this.#snapshotPath(docName);
    await mkdir(dirname(path), { recursive: true });
    await writeFile(path, snapshot);
    this.#dirty.delete(docName);
    this.#lastSavedAt.set(docName, Date.now());
    log.debug({ docName, bytes: snapshot.byteLength }, 'snapshot saved');
  }

  /**
   * Load a single doc's snapshot from disk. Returns null if not found.
   *
   * Migration path: if the new `.loro` file is missing but a legacy
   * `.snapshot` file exists, rename it in place and return its contents.
   * The next periodic save will overwrite with the current adapter's
   * encoding (JSON today, raw Loro bytes once truffle exposes export()).
   */
  async load(docName: KernelDocName): Promise<Uint8Array | null> {
    const path = this.#snapshotPath(docName);
    try {
      const buf = await readFile(path);
      log.debug({ docName, bytes: buf.byteLength }, 'snapshot loaded');
      return new Uint8Array(buf);
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code !== 'ENOENT') throw err;
    }

    // Fall back to legacy .snapshot; migrate if present.
    const legacyPath = this.#legacySnapshotPath(docName);
    try {
      const buf = await readFile(legacyPath);
      log.info({ docName }, 'migrating legacy .snapshot to .loro');
      await mkdir(dirname(path), { recursive: true });
      try {
        await rename(legacyPath, path);
      } catch {
        // Best-effort rename; fall back to write + unlink so the data is
        // at least preserved under the new name.
        await writeFile(path, buf);
        try {
          await unlink(legacyPath);
        } catch {
          /* ignore */
        }
      }
      return new Uint8Array(buf);
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code === 'ENOENT') return null;
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

  /** Get snapshot info for all docs (for debug UI). */
  async getSnapshotInfo(): Promise<SnapshotInfo[]> {
    const infos: SnapshotInfo[] = [];
    for (const name of KERNEL_DOC_NAMES) {
      const path = this.#snapshotPath(name);
      let bytes = 0;
      try {
        const s = await stat(path);
        bytes = s.size;
      } catch {
        // File doesn't exist yet
      }
      infos.push({
        docName: name,
        path,
        bytes,
        lastSavedAt: this.#lastSavedAt.get(name) ?? null,
      });
    }
    return infos;
  }

  /** Get the last save timestamp for a given doc. */
  getLastSavedAt(docName: KernelDocName): number | null {
    return this.#lastSavedAt.get(docName) ?? null;
  }
}
