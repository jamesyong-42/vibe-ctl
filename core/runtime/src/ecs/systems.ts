/**
 * Kernel ECS systems. Spec 02 §7.
 *
 * Topological order at the kernel level:
 *
 *   DiscoverySystem
 *     → DependencyResolutionSystem
 *     → ActivationSystem
 *       → HealthMonitorSystem
 *       → SyncBridgeSystem
 *     → DeactivationSystem
 *
 * These thin wrappers adapt plain classes / functions in sibling modules
 * to reactive-ecs's `defineSystem` registration shape. Kept tiny on purpose
 * — the interesting logic lives in the non-ECS modules.
 */

import { defineSystem } from '@jamesyong42/reactive-ecs';

/**
 * DiscoverySystem — scans plugin roots, parses manifests, creates entities.
 * Runs once at boot; can also be invoked on-demand (e.g. after an install).
 */
export const DiscoverySystem = defineSystem({
  name: 'DiscoverySystem',
  execute: () => {
    throw new Error('not implemented: DiscoverySystem.run');
  },
});

/**
 * DependencyResolutionSystem — topological sort, version checks,
 * cycle detection. Populates PluginDeps on every plugin entity.
 */
export const DependencyResolutionSystem = defineSystem({
  name: 'DependencyResolutionSystem',
  execute: () => {
    throw new Error('not implemented: DependencyResolutionSystem.run');
  },
});

/**
 * ActivationSystem — walks the topo-sorted list, loads modules, constructs
 * contexts, calls onActivate, attaches warmup. Transitions PluginState.
 */
export const ActivationSystem = defineSystem({
  name: 'ActivationSystem',
  execute: () => {
    throw new Error('not implemented: ActivationSystem.run');
  },
});

/**
 * DeactivationSystem — reverse-topo teardown. Fires signals, runs
 * onDeactivate, disposes tracked disposables.
 */
export const DeactivationSystem = defineSystem({
  name: 'DeactivationSystem',
  execute: () => {
    throw new Error('not implemented: DeactivationSystem.run');
  },
});

/**
 * HealthMonitorSystem — watches PluginHealth counters, auto-disables on
 * threshold crossings.
 */
export const HealthMonitorSystem = defineSystem({
  name: 'HealthMonitorSystem',
  execute: () => {
    throw new Error('not implemented: HealthMonitorSystem.run');
  },
});

/**
 * SyncBridgeSystem — mirrors the four kernel-managed docs into ECS
 * components so reactive queries see sync updates as component changes.
 * Spec 02 §7 final paragraph.
 *
 * Incoming sync deltas:
 *   kernel/plugin-inventory  → mutates PluginSource / creates entities
 *                              for peer-only plugins.
 *   kernel/permissions       → mutates PluginPermissions (specifically
 *                              `revoked`).
 *   kernel/user-settings     → emits `settings.changed` events.
 *   kernel/canvas-layout     → handled by the canvas-sync adapter in
 *                              `@vibe-ctl/canvas`, not here.
 *
 * The concrete implementation lives in `systems/sync-bridge-system.ts`
 * (createSyncBridge). This defineSystem stub remains for the kernel
 * system scheduler to reference; the real bridge is wired via
 * createSyncBridge() during bootstrap.
 */
export const SyncBridgeSystem = defineSystem({
  name: 'SyncBridgeSystem',
  execute: () => {
    // No-op in the defineSystem stub. The actual bridge is wired via
    // createSyncBridge() which uses direct doc subscriptions rather than
    // the ECS system loop. This entry exists so the system scheduler
    // has a named system for ordering purposes.
  },
});
