/**
 * PermissionManager. Spec 01 §9, spec 02 §9.
 *
 * Declared-in-manifest, checked-at-call-sites. Three operations:
 *   - grant(pluginId, permission)      — user consent, persisted locally.
 *   - require(pluginId, permission)    — called from ctx.permissions.require;
 *                                        prompts on first call, throws if
 *                                        user denies.
 *   - revoke(pluginId, permission)     — synced (spec 02 §9: revocations
 *                                        propagate, grants do not).
 *
 * Grants stay local to the device that issued them (spec 02 §9: "Grant on A
 * stays local"). Revocations flow through `kernel/permissions` as CRDT
 * entries; any device's revoke reduces capability everywhere.
 *
 * Tier shortcuts:
 *   - T1: all declared permissions implicitly granted (no prompt).
 *   - T2: install-time summary; prompt first-use on sensitive.
 *   - T3: install-time warning; prompt first-use always.
 */

import type { PluginTier } from '@vibe-ctl/plugin-api';
import type { KernelDocs } from './sync/kernel-docs.js';

export interface PermissionManagerOptions {
  docs: KernelDocs;
  /** User-facing prompt delegate; wired by the shell. */
  prompt: (req: PermissionPromptRequest) => Promise<boolean>;
}

export interface PermissionPromptRequest {
  pluginId: string;
  permission: string;
  reason?: string;
}

export class PermissionManager {
  readonly #opts: PermissionManagerOptions;

  constructor(opts: PermissionManagerOptions) {
    this.#opts = opts;
  }

  /** True if the permission is currently granted (any source). */
  has(_pluginId: string, _permission: string): boolean {
    throw new Error('not implemented: PermissionManager.has');
  }

  /**
   * Ensure a permission is granted. Called from `ctx.permissions.require`.
   * T1: never prompts. T2/T3: prompts on first use, persists decision.
   * Throws PermissionDenied if the user denies.
   */
  async require(_pluginId: string, _tier: PluginTier, _permission: string): Promise<void> {
    throw new Error('not implemented: PermissionManager.require');
  }

  /** Grant (on first user consent). Local only. */
  grant(_pluginId: string, _permission: string): void {
    throw new Error('not implemented: PermissionManager.grant');
  }

  /**
   * Revoke. Writes to `kernel/permissions`; propagates to all devices.
   * Spec 02 §9: revocations are safe to sync (can only reduce capability).
   */
  revoke(_pluginId: string, _permission: string): void {
    throw new Error('not implemented: PermissionManager.revoke');
  }

  /** Expose options for sibling modules. */
  get options(): Readonly<PermissionManagerOptions> {
    return this.#opts;
  }
}
