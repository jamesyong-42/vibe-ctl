/**
 * Kernel ↔ renderer doc-sync port protocol (spec 05 §6.4).
 *
 * The kernel utility holds the authoritative Loro replica for each
 * `kernel/*` doc and for each installed plugin's synced data. Each
 * renderer (main, detached, dynamic-island) opens one port per doc it
 * observes; the port carries binary deltas and snapshots in both
 * directions.
 *
 * `docName` naming (documented, not enforced at the type level):
 *   - kernel docs:       `kernel/plugin-inventory`, `kernel/canvas-layout`,
 *                        `kernel/user-settings`, `kernel/permissions`
 *   - plugin-owned docs: `plugin:${pluginId}:${docName}`
 */

export type DocSyncMessageType = 'snapshot' | 'delta' | 'request-snapshot';

export interface DocSyncMessage {
  type: DocSyncMessageType;
  /** Loro doc identifier (see naming comment above). */
  docName: string;
  /** Loro binary payload. Empty for `request-snapshot`. */
  payload: Uint8Array;
}
