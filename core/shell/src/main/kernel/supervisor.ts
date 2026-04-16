/**
 * Kernel-utility supervisor (spec 05 §6.4, spec 02 §10).
 *
 * Owns the spawned kernel utility child, its ctrl Comlink proxy, and
 * crash-recovery with exponential backoff: [1s, 4s, 16s]. After 3
 * failed restarts within 60s the supervisor gives up and emits 'failed'.
 * If a restart succeeds (child stays alive > 30s), the backoff resets.
 *
 * Backoff logic delegated to `CrashRecovery` from `@vibe-ctl/runtime`
 * so the same class is reusable for split-plugin supervisors (Phase 6).
 */

import { CrashRecovery, type KernelCtrl, createScopedLogger } from '@vibe-ctl/runtime';
import type * as Comlink from 'comlink';
import type { MessagePortMain, UtilityProcess } from 'electron';
import { createCtrlClient } from './ctrl-client.js';
import { spawnKernel } from './spawn.js';

const log = createScopedLogger('shell:kernel:supervisor');
const kernelLog = createScopedLogger('kernel');

export type SupervisorStatus = 'running' | 'restarting' | 'failed';

type StatusListener = (status: SupervisorStatus) => void;

const HEALTHY_THRESHOLD_MS = 30_000;

export interface KernelSupervisor {
  /** Current Comlink proxy (null during restart window). */
  getCtrl(): Comlink.Remote<KernelCtrl> | null;
  /**
   * Current kernel utility child (null during restart window).
   * Needed by main to broker per-window MessagePorts directly to the
   * utility process — spec 05 §6.4.
   */
  getChild(): UtilityProcess | null;
  /** Subscribe to status changes. Returns unsubscribe function. */
  onStatusChange(cb: StatusListener): () => void;
  /** Intentional shutdown — does not trigger restart. */
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
  let ctrl: Comlink.Remote<KernelCtrl> | null = null;
  let currentChild: UtilityProcess | null = null;
  let intentionalKill = false;
  let status: SupervisorStatus = 'running';
  const listeners = new Set<StatusListener>();
  let healthyTimer: ReturnType<typeof setTimeout> | null = null;

  const recovery = new CrashRecovery({
    maxRestarts: 3,
    windowMs: 60_000,
    backoffMs: [1_000, 4_000, 16_000],
  });

  function setStatus(s: SupervisorStatus): void {
    if (status === s) return;
    status = s;
    for (const cb of listeners) {
      try {
        cb(s);
      } catch {
        // Listener errors don't propagate.
      }
    }
  }

  async function spawnAndWire(): Promise<void> {
    const { child, ctrlPort } = await spawnKernel();
    pipeStdio(child);

    currentChild = child;
    ctrl = createCtrlClient(ctrlPort);

    // Start a timer: if the child survives past HEALTHY_THRESHOLD_MS,
    // consider it a successful restart and reset the backoff.
    healthyTimer = setTimeout(() => {
      recovery.reset();
      healthyTimer = null;
    }, HEALTHY_THRESHOLD_MS);

    child.on('exit', (code) => {
      if (healthyTimer) {
        clearTimeout(healthyTimer);
        healthyTimer = null;
      }

      ctrl = null;
      currentChild = null;

      if (intentionalKill) {
        log.info({ code }, 'kernel utility exited (intentional)');
        return;
      }

      log.warn({ code }, 'kernel utility exited unexpectedly');

      const action = recovery.recordCrash();
      if (action === 'failed') {
        log.error('kernel utility restart limit exceeded — marking as failed');
        setStatus('failed');
        return;
      }

      const delay = recovery.getBackoffMs();
      log.info({ delay, crashCount: recovery.crashCount }, 'scheduling kernel utility restart');
      setStatus('restarting');

      setTimeout(() => {
        if (intentionalKill) return;
        spawnAndWire()
          .then(() => {
            log.info('kernel utility restarted successfully');
            setStatus('running');
          })
          .catch((err) => {
            log.error({ err: String(err) }, 'kernel utility restart failed');
            const retryAction = recovery.recordCrash();
            if (retryAction === 'failed') {
              setStatus('failed');
            }
          });
      }, delay);
    });
  }

  // Initial spawn
  await spawnAndWire();
  setStatus('running');

  return {
    getCtrl(): Comlink.Remote<KernelCtrl> | null {
      return ctrl;
    },

    getChild(): UtilityProcess | null {
      return currentChild;
    },

    onStatusChange(cb: StatusListener): () => void {
      listeners.add(cb);
      return () => {
        listeners.delete(cb);
      };
    },

    kill(): void {
      intentionalKill = true;
      if (healthyTimer) {
        clearTimeout(healthyTimer);
        healthyTimer = null;
      }
      if (currentChild) {
        try {
          currentChild.kill();
        } catch (err) {
          log.warn({ err }, 'kill() threw');
        }
      }
      ctrl = null;
    },
  };
}
