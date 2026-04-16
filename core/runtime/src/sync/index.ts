/**
 * Sync fabric (Layer 2). See spec 02 §3–§5.
 *
 * Exposes the primitives kernel sub-systems use to reach sync. Plugin-
 * facing sync lives in `@vibe-ctl/plugin-api`'s `ctx.sync`; the
 * implementation bridges through here.
 */

export type { DocAuthorityOptions, RendererPort } from './doc-authority.js';
export { DocAuthority } from './doc-authority.js';
export type {
  CrdtDocHandle,
  DocChangeListener,
  KernelDocName,
  KernelDocsOptions,
  PluginInventoryEntry,
  PluginInventorySlice,
  SyncedStoreHandle,
} from './kernel-docs.js';
export { KERNEL_DOC_NAMES, KernelDocs } from './kernel-docs.js';
export type { MeshNodeOptions, Peer, PeerChangeEvent } from './mesh-node.js';
export { MeshNode } from './mesh-node.js';
export type { OfflineModeConfig, OfflineModeOptions } from './offline-mode.js';
export {
  OfflineMode,
  resolveOfflineMode,
  shouldSyncKernelDoc,
  shouldSyncPlugin,
} from './offline-mode.js';
export type {
  TruffleCrdtDoc,
  TruffleHealthInfo,
  TruffleModule,
  TruffleNapiNode,
  TrufflePeer,
  TrufflePeerEvent,
  TruffleSyncedStore,
} from './truffle-types.js';
export { loadTruffle } from './truffle-types.js';
export type { VersionBeacon } from './version-beacons.js';
export { VersionBeacons } from './version-beacons.js';
export type { VersionGateOptions, VersionGateResult } from './version-gate.js';
export { checkVersionGate, publishVersionBeacon } from './version-gate.js';
