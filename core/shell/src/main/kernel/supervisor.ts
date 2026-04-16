/**
 * Kernel-utility supervisor (spec 05 §6.4, spec 02 §10).
 *
 * Owns the spawned kernel utility child, its ctrl Comlink proxy, and
 * crash-recovery with exponential backoff: [1s, 4s, 16s]. After 3
 * failed restarts within 60s the supervisor gives up and emits 'failed'.
 * If a restart succeeds (child stays alive > 30s), the backoff resets.
 */

import { type KernelCtrl, createScopedLogger } from '@vibe-ctl/runtime';
import type * as Comlink from 'comlink';
import type { MessagePortMain, UtilityProcess } from 'electron';
import { createCtrlClient } from './ctrl-client.js';
import { spawnKernel } from './spawn.js';

const log = createScopedLogger('shell:kernel:supervisor');
const kernelLog = createScopedLogger('kernel');

export type SupervisorStatus = 'running' | 'restarting' | 'failed';

type StatusListener = (status: SupervisorStatus) => void;

const BACKOFF_MS = [1_000, 4_000, 16_000];
const MAX_RESTARTS = 3;
const WINDOW_MS = 60_000;
const HEALTHY_THRESHOLD_MS = 30_000;

export interface KernelSupervisor {
  /** Current Comlink proxy (null during restart window). */
  getCtrl(): Comlink.Remote<KernelCtrl> | null;
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
  let currentPort: MessagePortMain | null = null;
  let intentionalKill = false;
  let status: SupervisorStatus = 'running';
  const listeners = new Set<StatusListener>();

  // Crash tracking (inline; extracted to CrashRecovery in commit 9)
  const crashTimestamps: number[] = [];
  let crashCount = 0;
  let healthyTimer: ReturnType<typeof setTimeout> | null = null;

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

  function recordCrash(): 'restart' | 'failed' {
    const now = Date.now();
    crashTimestamps.push(now);

    // Prune timestamps outside the rolling window.
    while (crashTimestamps.length > 0 && crashTimestamps[0]! < now - WINDOW_MS) {
      crashTimestamps.shift();
    }

    crashCount++;
    if (crashTimestamps.length > MAX_RESTARTS) {
      return 'failed';
    }
    return 'restart';
  }

  function getBackoffMs(): number {
    return BACKOFF_MS[Math.min(crashCount - 1, BACKOFF_MS.length - 1)]!;
  }

  function resetCrashState(): void {
    crashTimestamps.length = 0;
    crashCount = 0;
  }

  async function spawnAndWire(): Promise<void> {
    const { child, ctrlPort } = await spawnKernel();
    pipeStdio(child);

    currentChild = child;
    currentPort = ctrlPort;
    ctrl = createCtrlClient(ctrlPort);

    // Start a timer: if the child survives past HEALTHY_THRESHOLD_MS,
    // consider it a successful restart and reset the backoff.
    healthyTimer = setTimeout(() => {
      resetCrashState();
      healthyTimer = null;
    }, HEALTHY_THRESHOLD_MS);

    child.on('exit', (code) => {
      if (healthyTimer) {
        clearTimeout(healthyTimer);
        healthyTimer = null;
      }

      ctrl = null;
      currentChild = null;
      currentPort = null;

      if (intentionalKill) {
        log.info({ code }, 'kernel utility exited (intentional)');
        return;
      }

      log.warn({ code }, 'kernel utility exited unexpectedly');

      const action = recordCrash();
      if (action === 'failed') {
        log.error('kernel utility restart limit exceeded — marking as failed');
        setStatus('failed');
        return;
      }

      const delay = getBackoffMs();
      log.info({ delay, crashCount }, 'scheduling kernel utility restart');
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
            const retryAction = recordCrash();
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
