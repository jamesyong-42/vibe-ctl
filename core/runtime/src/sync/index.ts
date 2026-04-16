/**
 * Sync fabric (Layer 2). See spec 02 §3–§5.
 *
 * Exposes the primitives kernel sub-systems use to reach sync. Plugin-
 * facing sync lives in `@vibe-ctl/plugin-api`'s `ctx.sync`; the
 * implementation bridges through here.
 */

export { MeshNode } from './mesh-node.js';
export type { MeshNodeOptions, Peer, PeerChangeEvent, TruffleNode } from './mesh-node.js';

export { DocAuthority } from './doc-authority.js';
export type { DocAuthorityOptions, RendererPort } from './doc-authority.js';

export { KernelDocs, KERNEL_DOC_NAMES } from './kernel-docs.js';
export type {
  CrdtDocHandle,
  DocChangeListener,
  KernelDocName,
  KernelDocsOptions,
  SyncedStoreHandle,
  PluginInventoryEntry,
  PluginInventorySlice,
} from './kernel-docs.js';

export { runVersionGate, publishVersionBeacon } from './version-gate.js';
export type { VersionGateOptions, VersionGateResult } from './version-gate.js';

export {
  resolveOfflineMode,
  shouldSyncKernelDoc,
  shouldSyncPlugin,
} from './offline-mode.js';
export type { OfflineModeConfig } from './offline-mode.js';
