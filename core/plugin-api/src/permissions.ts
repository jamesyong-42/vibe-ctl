/**
 * Permission API and string helpers.
 *
 * Permissions are plain strings declared in `manifest.permissions[]` and
 * enforced at call sites via `ctx.permissions.require()`. Two shapes:
 *
 *   - `<plugin-id>:<action>`   — plugin-specific (e.g. `claude-code:approve`)
 *   - `<system-category>`      — kernel-owned (e.g. `filesystem.state`,
 *                                  `mesh:broadcast`, `clipboard:read`)
 */

/**
 * Well-known kernel permissions. Plugin-specific permissions are free-form
 * strings; this union is only exhaustive for kernel-owned categories.
 */
export type KernelPermission =
  | 'filesystem.state'
  | 'filesystem.workspace'
  | 'network'
  | 'mesh:broadcast'
  | 'mesh:proxy'
  | 'notifications'
  | 'clipboard:read'
  | 'clipboard:write';

/** Any valid permission string. */
export type PermissionString = KernelPermission | (string & {});

export interface PermissionAPI {
  /**
   * Ensure the plugin holds the given permission. On first call for a
   * non-granted permission, the kernel prompts the user with the given
   * reason; the decision is persisted.
   *
   * Throws `PermissionDenied` if the user declines.
   */
  require(permission: PermissionString, reason?: string): Promise<void>;

  /**
   * Non-prompting check. Returns `true` if already granted, `false`
   * otherwise. Useful for conditional UI.
   */
  has(permission: PermissionString): boolean;

  /**
   * Build a plugin-scoped permission string, e.g. `myPlugin:read-transcripts`.
   * Convenience helper; callers may construct strings directly.
   */
  scoped(action: string): string;
}

/**
 * Thrown by `permissions.require()` when the user denies the prompt.
 */
export class PermissionDenied extends Error {
  override readonly name = 'PermissionDenied';
  constructor(
    readonly permission: string,
    readonly pluginId: string,
  ) {
    super(`Permission '${permission}' denied for plugin '${pluginId}'`);
  }
}
