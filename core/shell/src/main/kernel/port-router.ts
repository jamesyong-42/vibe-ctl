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

/**
 * Mint a fresh doc-sync channel, ship the utility end to the kernel, and
 * return the renderer end for transfer via the handshake.
 *
 * This is the single broker point for the kernel utility ↔ renderer
 * doc-sync fabric described in spec 05 §6.4.
 */
export function brokerDocSyncPort(kernelChild: UtilityProcess): {
  utilityPort: MessagePortMain;
  rendererPort: MessagePortMain;
} {
  const { rendererPort, kernelPort } = mintDocSyncPair();
  kernelChild.postMessage({ type: 'doc-sync-port' }, [kernelPort]);
  log.debug('brokered doc-sync port to kernel utility');
  return { utilityPort: kernelPort, rendererPort };
}

/**
 * Mint an event-port pair and ship the kernel end to the kernel utility.
 * The kernel utility's EventSink posts EventPortMessage envelopes through
 * its end; main listens on the returned `mainPort` and forwards to every
 * renderer's event port.
 *
 * This replaces the earlier Comlink.proxy(cb) callback approach — Electron's
 * MessagePortMain cannot transfer a Web MessageChannel port (which
 * Comlink.proxy mints internally) so callback-over-Comlink throws
 * "object could not be cloned".
 */
export function brokerEventPort(kernelChild: UtilityProcess): {
  mainPort: MessagePortMain;
} {
  const { port1, port2 } = new MessageChannelMain();
  kernelChild.postMessage({ type: 'event-port' }, [port2]);
  log.debug('brokered event port to kernel utility');
  return { mainPort: port1 };
}
