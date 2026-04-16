/**
 * Deep-link handler (spec 05 §4.5).
 *
 * `vibe-ctl://` URLs registered with the OS route through the
 * single-instance handler and dispatch to the kernel command registry
 * (e.g. `vibe-ctl://install?repo=acme/x`).
 *
 * Phase-1: stub. Phase 7 fills in the real parser + dispatch.
 */

import { createScopedLogger } from '@vibe-ctl/runtime';

const log = createScopedLogger('shell:deep-links');

// Placeholder: Phase 7 will thread in the kernel command dispatcher
// handle so the URL parser can route `vibe-ctl://install?repo=…` to
// `commands.invoke('plugins.installFromRepo', …)`.
export type DeepLinkCtx = Record<string, never>;

export function registerDeepLinks(_ctx: DeepLinkCtx): void {
  log.debug('deep-link registration stub — no-op');
}
