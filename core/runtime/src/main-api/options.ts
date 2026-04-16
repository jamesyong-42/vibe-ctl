/**
 * Construction options for the Runtime (spec 02 §10, spec 05 §2).
 *
 * The runtime is Electron-agnostic — the shell owns process topology and
 * passes pre-spawned handles in. Notably `kernelCtrl` is a Comlink proxy
 * over a MessagePort to the kernel utility that the shell has already
 * forked.
 */

import type { Logger } from '@vibe-ctl/plugin-api';
import type { KernelCtrl } from '../ipc/kernel-ctrl.js';
import type { CanvasEngineHandle } from '../types.js';

export interface RuntimeOptions {
  /** Directories scanned for user-installed plugins, in priority order. */
  pluginDirs: string[];
  /**
   * Directories scanned for built-in (T1) plugins. Typically
   * `{app.resources}/plugins/`.
   */
  builtInPluginRoots: string[];
  /**
   * Optional dev-symlink roots (from `$VIBE_CTL_DEV_PLUGINS`). Loaded as T3
   * with hot reload.
   */
  devPluginRoots?: string[];
  /** Canvas engine handle (wired by the shell, typed loosely for now). */
  canvasEngine: CanvasEngineHandle | unknown;
  /** Kernel-scoped logger. */
  logger: Logger;
  /** Semver string for this kernel build. Used for the version gate. */
  kernelVersion: string;
  /**
   * Persistent user-data dir (e.g. Electron's `app.getPath('userData')`).
   * Plugins receive per-id subdirs of this via ctx.dataDir.
   */
  userDataDir: string;
  /** Stable device identifier used by sync slices. */
  deviceId: string;
  /** Human-readable device name, surfaced to other peers. */
  deviceName: string;
  /** If true, skip the truffle NapiNode entirely (offline/selective sync). */
  offline?: boolean;
  /**
   * Comlink-wrapped handle to the kernel utility's ctrl service. The shell
   * forks the utility process, wires the MessagePort, and hands the proxy
   * in here — runtime never touches `utilityProcess.fork` itself.
   */
  kernelCtrl?: KernelCtrl;
}
