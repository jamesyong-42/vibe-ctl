/**
 * SyncBridgeSystem — mirrors kernel doc changes into ECS components
 * so reactive queries fire (spec 02 §7, §3.3).
 *
 * Subscribes to kernel doc changes and updates ECS components accordingly:
 *   - kernel/plugin-inventory changes -> update plugin entities
 *   - kernel/canvas-layout changes -> handled by canvas-sync adapter (Phase 5)
 *   - kernel/user-settings changes -> update settings cache (commit 8)
 *   - kernel/permissions changes -> update PermissionGrant entities
 *
 * For Phase 4, implements plugin-inventory and permissions bridges.
 * Canvas and settings bridges are stubs for later phases.
 */

import type { Disposable } from '@vibe-ctl/plugin-api';
import { createScopedLogger } from '../../logging/index.js';
import type { KernelDocName } from '../../sync/kernel-docs.js';

const log = createScopedLogger('ecs:sync-bridge');

/**
 * Minimal doc subscription interface. Can be backed by either the
 * kernel-utility's KernelDocs (authoritative) or the renderer's
 * KernelDocStore (replica). This abstraction keeps the system
 * process-agnostic.
 */
export interface DocSubscription {
  subscribe(docName: KernelDocName, cb: (delta: Uint8Array) => void): Disposable;
}

export interface SyncBridgeCallbacks {
  onInventoryChange?: (delta: Uint8Array) => void;
  onCanvasLayoutChange?: (delta: Uint8Array) => void;
  onUserSettingsChange?: (delta: Uint8Array) => void;
  onPermissionsChange?: (delta: Uint8Array) => void;
}

/**
 * Create a SyncBridge that subscribes to doc changes and invokes callbacks.
 * Returns a disposable that tears down all subscriptions.
 *
 * Plugin-inventory bridge: parses inventory deltas and invokes the callback
 * so the caller can update ECS plugin entities.
 *
 * Permissions bridge: parses permission deltas and invokes the callback
 * so the caller can update PermissionGrant entities.
 */
export function createSyncBridge(
  docs: DocSubscription,
  callbacks: SyncBridgeCallbacks,
): Disposable {
  const disposables: Disposable[] = [];

  // --- Plugin inventory bridge ---
  if (callbacks.onInventoryChange) {
    const cb = callbacks.onInventoryChange;
    const sub = docs.subscribe('kernel/plugin-inventory', (delta) => {
      try {
        cb(delta);
      } catch (err) {
        log.warn({ err: String(err) }, 'inventory bridge callback threw');
      }
    });
    disposables.push(sub);
  }

  // --- Canvas layout bridge (stub - Phase 5) ---
  if (callbacks.onCanvasLayoutChange) {
    const cb = callbacks.onCanvasLayoutChange;
    const sub = docs.subscribe('kernel/canvas-layout', (delta) => {
      try {
        cb(delta);
      } catch (err) {
        log.warn({ err: String(err) }, 'canvas-layout bridge callback threw');
      }
    });
    disposables.push(sub);
  }

  // --- User settings bridge (stub - commit 8) ---
  if (callbacks.onUserSettingsChange) {
    const cb = callbacks.onUserSettingsChange;
    const sub = docs.subscribe('kernel/user-settings', (delta) => {
      try {
        cb(delta);
      } catch (err) {
        log.warn({ err: String(err) }, 'user-settings bridge callback threw');
      }
    });
    disposables.push(sub);
  }

  // --- Permissions bridge ---
  if (callbacks.onPermissionsChange) {
    const cb = callbacks.onPermissionsChange;
    const sub = docs.subscribe('kernel/permissions', (delta) => {
      try {
        cb(delta);
      } catch (err) {
        log.warn({ err: String(err) }, 'permissions bridge callback threw');
      }
    });
    disposables.push(sub);
  }

  log.info('sync bridge wired');

  return {
    [Symbol.dispose]() {
      for (const d of disposables) d[Symbol.dispose]?.();
      log.info('sync bridge disposed');
    },
  };
}
