/**
 * Port router — mints doc-sync MessageChannel pairs and ships them to
 * the kernel utility and renderer (spec 05 §6.4).
 *
 * When a renderer window is created, main mints a MessageChannelMain.
 * One end goes to the kernel utility (via its parentPort), the other
 * goes to the renderer via the handshake payload. Main never inspects
 * messages after brokering.
 */

import { createScopedLogger } from '@vibe-ctl/runtime';
import { MessageChannelMain, type MessagePortMain, type UtilityProcess } from 'electron';

const log = createScopedLogger('shell:kernel:port-router');

export interface DocSyncPortPair {
  /** Port to send to the renderer (via the handshake). */
  rendererPort: MessagePortMain;
  /** Port to send to the kernel utility. */
  kernelPort: MessagePortMain;
}

/**
 * Mint a doc-sync MessageChannel pair. Main keeps neither end; both are
 * transferred to their respective processes.
 */
export function mintDocSyncPair(): DocSyncPortPair {
  const { port1, port2 } = new MessageChannelMain();
  return { rendererPort: port1, kernelPort: port2 };
}

/**
 * Transfer a doc-sync port to the kernel utility process. The kernel
 * utility's DocRouter picks it up via a 'doc-sync-port' message.
 */
export function transferToKernel(child: UtilityProcess, port: MessagePortMain): void {
  child.postMessage({ type: 'doc-sync-port' }, [port]);
  log.debug('transferred doc-sync port to kernel utility');
}

/**
 * Set up doc-sync ports for a new renderer window. Returns the renderer-side
 * port (to include in the handshake) and transfers the kernel-side port
 * to the kernel utility.
 */
export function setupDocSyncPorts(opts: {
  kernelChild: UtilityProcess;
}): MessagePortMain {
  const { rendererPort, kernelPort } = mintDocSyncPair();
  transferToKernel(opts.kernelChild, kernelPort);
  return rendererPort;
}
