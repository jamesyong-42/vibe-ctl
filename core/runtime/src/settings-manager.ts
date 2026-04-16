/**
 * SettingsManager. Spec 01 §5 (ctx.settings), spec 02 §4.
 *
 * Reads and writes `kernel/user-settings` (a Loro Map keyed by
 * `{pluginId}.{key}`). Per spec 01's "only ctx.settings.* accesses synced
 * user settings" decision, this is the sole path for plugin settings.
 *
 * Per-plugin `ctx.settings` facades scope key names to `{pluginId}.*`
 * automatically; this manager enforces that on writes as a defence in depth.
 *
 * The delta produced by a write propagates through the doc-sync channel
 * automatically (DocAuthority fans it out to other renderers + mesh peers).
 */

import type { Disposable } from '@vibe-ctl/plugin-api';
import { createScopedLogger } from './logging/index.js';
import type { CrdtDocHandle, KernelDocs } from './sync/kernel-docs.js';

const log = createScopedLogger('settings-manager');

export interface SettingsManagerOptions {
  docs: KernelDocs;
}

/** Construct the full settings key: `{pluginId}.{key}`. */
function settingsKey(pluginId: string, key: string): string {
  return `${pluginId}.${key}`;
}

export class SettingsManager {
  readonly #opts: SettingsManagerOptions;
  /** Lazily cached doc handle (avoids accessing KernelDocs before open). */
  #doc: CrdtDocHandle | null = null;

  constructor(opts: SettingsManagerOptions) {
    this.#opts = opts;
  }

  /** Get the userSettings doc handle, caching on first access. */
  #getDoc(): CrdtDocHandle {
    if (!this.#doc) {
      this.#doc = this.#opts.docs.userSettings;
    }
    return this.#doc;
  }

  /**
   * Read a setting for a plugin. Returns undefined if not set.
   * Key is scoped: actual doc key is `{pluginId}.{key}`.
   */
  read<T = unknown>(pluginId: string, key: string): T | undefined {
    const fullKey = settingsKey(pluginId, key);
    return this.#getDoc().get(fullKey) as T | undefined;
  }

  /** Alias for `read` — matches the existing stub signature. */
  get<T = unknown>(pluginId: string, key: string): T | undefined {
    return this.read<T>(pluginId, key);
  }

  /**
   * Write a setting. The delta propagates through the doc-sync channel
   * automatically. Key is scoped: actual doc key is `{pluginId}.{key}`.
   */
  write(pluginId: string, key: string, value: unknown): void {
    const fullKey = settingsKey(pluginId, key);
    this.#getDoc().set(fullKey, value);
    log.debug({ pluginId, key, fullKey }, 'setting written');
  }

  /** Alias for `write` — matches the existing stub signature. */
  update<T = unknown>(pluginId: string, key: string, value: T): void {
    this.write(pluginId, key, value);
  }

  /**
   * Subscribe to changes on a specific plugin+key. Notified when the
   * underlying doc changes (from local writes, peer deltas, or
   * renderer edits).
   */
  subscribe(pluginId: string, key: string, cb: (value: unknown) => void): Disposable {
    const fullKey = settingsKey(pluginId, key);
    const doc = this.#getDoc();
    return doc.subscribe((_delta) => {
      // On any doc change, re-read the specific key and notify if it exists.
      // This is coarse-grained (fires on any doc change, not just this key).
      // Acceptable for the current doc size; can be narrowed by parsing the
      // delta if performance becomes an issue.
      const current = doc.get(fullKey);
      cb(current);
    });
  }

  /** Alias for `subscribe` — matches the existing stub signature. */
  onChange(pluginId: string, key: string, cb: (value: unknown) => void): Disposable {
    return this.subscribe(pluginId, key, cb);
  }

  /**
   * Read all settings for a plugin. Returns a record of `{key: value}`
   * (with the pluginId prefix stripped).
   */
  readAll(pluginId: string): Record<string, unknown> {
    const prefix = `${pluginId}.`;
    const doc = this.#getDoc();
    const result: Record<string, unknown> = {};
    for (const [fullKey, value] of doc.entries()) {
      if (fullKey.startsWith(prefix)) {
        const shortKey = fullKey.slice(prefix.length);
        result[shortKey] = value;
      }
    }
    return result;
  }

  /** Expose options to sibling modules (e.g. ContextBuilder). */
  get options(): Readonly<SettingsManagerOptions> {
    return this.#opts;
  }
}
