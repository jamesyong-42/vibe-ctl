/**
 * Host-provided module resolution. Spec 03 §4.
 *
 * Plugins mark these packages `external` in their bundler:
 *   @vibe-ctl/extension-api, react, react-dom,
 *   @jamesyong42/infinite-canvas, @jamesyong42/reactive-ecs,
 *   @vibecook/truffle
 *
 * At plugin load, the renderer/main resolver redirects those imports to
 * the host's singletons via a `host://` protocol registered in the
 * Electron shell. This file builds the import map.
 */

/** The canonical list of host-provided packages. */
export const HOST_PROVIDED_PACKAGES = Object.freeze([
  '@vibe-ctl/extension-api',
  'react',
  'react-dom',
  '@jamesyong42/infinite-canvas',
  '@jamesyong42/reactive-ecs',
  '@vibecook/truffle',
] as const);

export type HostProvidedPackage = (typeof HOST_PROVIDED_PACKAGES)[number];

export interface ImportMap {
  imports: Record<string, string>;
}

/**
 * Build an import map from package name → `host://{package}` URL. The shell
 * registers a protocol handler that dereferences `host://` to the in-process
 * module instance.
 */
export function buildHostImportMap(): ImportMap {
  throw new Error('not implemented: buildHostImportMap');
}

/**
 * Verify that a plugin's bundled `dist/*.js` does not re-embed a copy of a
 * host-provided package. Returns the list of offending packages (empty
 * means clean).
 */
export async function verifyNoHostProvidedBundling(_pluginDistDir: string): Promise<string[]> {
  throw new Error('not implemented: verifyNoHostProvidedBundling');
}
