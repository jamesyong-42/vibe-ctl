/**
 * Kernel-utility supervisor (spec 05 §6.4, spec 02 §10).
 *
 * Phase-1 scope: own the spawned child + ctrl proxy; log its lifecycle;
 * stream its stdio through the shell's pino logger with a `kernel` scope.
 * Crash-recovery with exponential backoff lands in Phase 3
 * (`feat(runtime): supervisor restart policy for kernel utility`).
 */

import { type KernelCtrl, createScopedLogger } from '@vibe-ctl/runtime';
import type * as Comlink from 'comlink';
import type { MessagePortMain, UtilityProcess } from 'electron';
import { createCtrlClient } from './ctrl-client.js';
import { spawnKernel } from './spawn.js';

const log = createScopedLogger('shell:kernel:supervisor');
const kernelLog = createScopedLogger('kernel');

export interface KernelSupervisor {
  /** Comlink proxy over the utility's KernelCtrl service. */
  readonly ctrl: Comlink.Remote<KernelCtrl>;
  /** The underlying UtilityProcess handle (rarely needed outside kernel/*). */
  readonly child: UtilityProcess;
  /** Main-side end of the ctrl port (shell owns lifetime). */
  readonly ctrlPort: MessagePortMain;
  /** Ask the utility to exit; does not wait. */
  kill(): void;
}

function pipeStdio(child: UtilityProcess): void {
  child.stdout?.setEncoding('utf8');
  child.stderr?.setEncoding('utf8');
  child.stdout?.on('data', (chunk: string) => {
    for (const line of chunk.split('\n')) {
      const trimmed = line.trimEnd();
      if (trimmed) kernelLog.info(trimmed);
    }
  });
  child.stderr?.on('data', (chunk: string) => {
    for (const line of chunk.split('\n')) {
      const trimmed = line.trimEnd();
      if (trimmed) kernelLog.error(trimmed);
    }
  });
}

export async function startKernelSupervisor(): Promise<KernelSupervisor> {
  const { child, ctrlPort } = await spawnKernel();
  pipeStdio(child);

  child.on('exit', (code) => {
    log.warn({ code }, 'kernel utility exited');
    // Phase-3 restart policy lands here.
  });

  const ctrl = createCtrlClient(ctrlPort);

  return {
    ctrl,
    child,
    ctrlPort,
    kill() {
      try {
        child.kill();
      } catch (err) {
        log.warn({ err }, 'kill() threw');
      }
    },
  };
}
