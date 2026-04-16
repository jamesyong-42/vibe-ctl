/**
 * Fork the kernel utility process (spec 05 §2.2, §6.4).
 *
 * The @vibe-ctl/runtime package publishes the utility entry via its
 * `./kernel-utility` export (tsup emits `dist/kernel-utility.js`). We
 * resolve that path with `createRequire().resolve(...)` to sidestep
 * `import.meta.resolve` stability issues in Electron's bundled Node —
 * the shell's main process is ESM and has `import.meta.url` available,
 * so `createRequire(import.meta.url)` is the portable route.
 *
 * Returns the `UtilityProcess` handle plus the main-side end of a
 * freshly minted ctrl MessageChannel; the utility receives the other
 * end via `child.postMessage(null, [port2])`.
 */

import { createRequire } from 'node:module';
import { createScopedLogger } from '@vibe-ctl/runtime';
import {
  MessageChannelMain,
  type MessagePortMain,
  type UtilityProcess,
  utilityProcess,
} from 'electron';

const log = createScopedLogger('shell:kernel:spawn');

export interface KernelSpawnResult {
  child: UtilityProcess;
  /** Main-side end of the ctrl channel. The utility already holds the other end. */
  ctrlPort: MessagePortMain;
}

export interface SpawnKernelOptions {
  /**
   * Directory the kernel utility should use for persisted Loro snapshots,
   * tailscale state, and the truffle sidecar's runtime dir. Mapped to the
   * `VIBE_CTL_DATA_DIR` env var which the utility's entry.ts picks up —
   * without it the utility falls back to `process.cwd()` which is wrong
   * (writes land inside the repo).
   */
  dataDir: string;
}

function resolveKernelEntry(): string {
  const require = createRequire(import.meta.url);
  return require.resolve('@vibe-ctl/runtime/kernel-utility');
}

/**
 * Fork the kernel utility. Resolves when the child has spawned (i.e. on
 * `spawn` event). Transfer of the ctrl port happens synchronously once
 * that event fires so the utility's `onFirstMessage` handler can pick
 * it up in the order this function returns.
 */
export async function spawnKernel(opts: SpawnKernelOptions): Promise<KernelSpawnResult> {
  const entry = resolveKernelEntry();
  log.info({ entry, dataDir: opts.dataDir }, 'forking kernel utility');

  const child = utilityProcess.fork(entry, [], {
    serviceName: 'vibe-ctl-kernel',
    stdio: 'pipe',
    env: {
      ...process.env,
      VIBE_CTL_DATA_DIR: opts.dataDir,
    },
  });

  await new Promise<void>((resolvePromise, reject) => {
    const onSpawn = (): void => {
      child.off('exit', onEarlyExit);
      resolvePromise();
    };
    const onEarlyExit = (code: number | null): void => {
      child.off('spawn', onSpawn);
      reject(new Error(`kernel utility exited before spawn (code=${code})`));
    };
    child.once('spawn', onSpawn);
    child.once('exit', onEarlyExit);
  });

  const { port1: ctrlPort, port2: utilityPort } = new MessageChannelMain();
  // Ship the utility's end through the built-in parentPort pipe. The
  // kernel-utility entry listens for the first message with ports.
  child.postMessage(null, [utilityPort]);

  return { child, ctrlPort };
}
