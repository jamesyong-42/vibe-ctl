/**
 * Comlink client wrapper for the kernel utility's ctrl port (spec 05 §6.4).
 *
 * The shell's main process holds one `MessagePortMain` per running
 * kernel utility; this module wraps it with Comlink so callers can
 * `await ctrl.getVersion()` as if the utility were in-process.
 *
 * The Endpoint adapter lives in `@vibe-ctl/runtime` (`nodeEndpoint`) so
 * it's shared with the utility-process side.
 */

import type { KernelCtrl, NodeMessagePort } from '@vibe-ctl/runtime';
import { nodeEndpoint } from '@vibe-ctl/runtime';
import * as Comlink from 'comlink';
import type { MessagePortMain } from 'electron';

export function createCtrlClient(port: MessagePortMain): Comlink.Remote<KernelCtrl> {
  port.start();
  return Comlink.wrap<KernelCtrl>(nodeEndpoint(port as unknown as NodeMessagePort));
}
