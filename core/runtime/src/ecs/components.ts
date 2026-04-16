/**
 * Kernel ECS components. Spec 02 §7.
 *
 * These components populate the kernel world that mirrors plugin state and
 * sync docs. Plugins never query this world directly; UI + systems in
 * `@vibe-ctl/runtime` and `@vibe-ctl/shell` do.
 *
 * Naming follows the spec's list (§7 "Typical kernel entities and
 * components"). When sync deltas arrive for the four kernel-managed docs,
 * the SyncBridgeSystem (see `systems.ts`) mutates these components so
 * reactive queries re-fire.
 */

import { defineComponent } from '@jamesyong42/reactive-ecs';
import type { PluginTier } from '@vibe-ctl/plugin-api';
import type { PluginSource, PluginState } from '../types.js';

type ManifestData = {
  id: string;
  name: string;
  version: string;
  apiVersion: string;
  executionContext: 'renderer' | 'main' | 'split';
  eagerActivation: boolean;
  description: string;
  provides: Record<string, string>;
  dependencies: Record<string, string>;
  optionalDependencies: Record<string, string>;
  waitForReady: string[];
  permissions: string[];
  hostProvided: string[];
  sync: {
    settings: boolean;
    data: Array<{ name: string; type: 'crdt' | 'store'; scope: 'user-global' | 'per-device' }>;
  };
};

// ─── Parsed manifest (frozen after discovery) ─────────────────────────
export const PluginManifest = defineComponent<ManifestData>('PluginManifest', {
  id: '',
  name: '',
  version: '0.0.0',
  apiVersion: '*',
  executionContext: 'renderer',
  eagerActivation: false,
  description: '',
  provides: {},
  dependencies: {},
  optionalDependencies: {},
  waitForReady: [],
  permissions: [],
  hostProvided: [],
  sync: { settings: true, data: [] },
});

// ─── Where the plugin was discovered from ─────────────────────────────
export const PluginSource_ = defineComponent<PluginSource>('PluginSource', {
  kind: 'built-in',
  path: '',
});
export { PluginSource_ as PluginSource };

// ─── Runtime state ────────────────────────────────────────────────────
export const PluginState_ = defineComponent<{ value: PluginState }>('PluginState', {
  value: 'discovered' as PluginState,
});
export { PluginState_ as PluginState };

// ─── Tier (source-determined, never trusted from manifest) ───────────
export const PluginTier_ = defineComponent<{ value: PluginTier }>('PluginTier', {
  value: 'T3' as PluginTier,
});
export { PluginTier_ as PluginTier };

// ─── The Plugin class instance (post-activation) ─────────────────────
export const PluginInstance = defineComponent<{
  /** Opaque; narrowed by the ActivationSystem. */
  instance: unknown;
}>('PluginInstance', { instance: null });

// ─── The loaded ESM module ───────────────────────────────────────────
export const PluginModule = defineComponent<{
  module: unknown;
  /** Path the module was loaded from. Useful for hot reload + debugging. */
  path: string;
}>('PluginModule', { module: null, path: '' });

// ─── Resolved dependency graph edges ─────────────────────────────────
export const PluginDeps = defineComponent<{
  /** Plugin IDs this plugin depends on (required). */
  requires: string[];
  /** Optional deps (present if installed, ignored otherwise). */
  optional: string[];
  /** Plugin IDs that depend on this one. Maintained for cascade teardown. */
  dependents: string[];
}>('PluginDeps', { requires: [], optional: [], dependents: [] });

// ─── Health counters (for HealthSystem) ───────────────────────────────
export const PluginHealth = defineComponent<{
  errorCount: number;
  restartCount: number;
  lastErrorAt: number;
  lastRestartAt: number;
}>('PluginHealth', { errorCount: 0, restartCount: 0, lastErrorAt: 0, lastRestartAt: 0 });

// ─── Services this plugin provides ────────────────────────────────────
export const PluginProvidedServices = defineComponent<{
  services: Array<{ id: string; version: string; ready: boolean }>;
}>('PluginProvidedServices', { services: [] });

// ─── Services this plugin consumes ────────────────────────────────────
export const PluginRequiredServices = defineComponent<{
  services: Array<{ id: string; range: string; optional: boolean }>;
}>('PluginRequiredServices', { services: [] });

// ─── Permission state (mirrored from kernel/permissions) ─────────────
export const PluginPermissions = defineComponent<{
  declared: string[];
  granted: string[];
  /** Revocations are synced (spec 02 §9). */
  revoked: string[];
}>('PluginPermissions', { declared: [], granted: [], revoked: [] });

// ─── Disposables ref count; the actual list lives in DisposableTracker ──
export const PluginDisposables = defineComponent<{ count: number }>('PluginDisposables', {
  count: 0,
});

// ─── Service registry entries (one entity per registered service) ────
export const ServiceEntry = defineComponent<{
  id: string;
  version: string;
  providerId: string;
  warmup: boolean;
  tierRestriction: string;
}>('ServiceEntry', {
  id: '',
  version: '',
  providerId: '',
  warmup: false,
  tierRestriction: '',
});

// ─── Widget type registry entries (one entity per registered widget type) ──
export const WidgetType = defineComponent<{
  type: string;
  ownedByPlugin: string;
  placements: string[];
  component: unknown;
  configSchema: unknown;
}>('WidgetType', {
  type: '',
  ownedByPlugin: '',
  placements: [],
  component: null,
  configSchema: null,
});

// ─── Permission grants (one entity per grant decision) ───────────────
export const PermissionGrant = defineComponent<{
  pluginId: string;
  permission: string;
  grantedAt: number;
  revokedAt: number;
}>('PermissionGrant', {
  pluginId: '',
  permission: '',
  grantedAt: 0,
  revokedAt: 0,
});
