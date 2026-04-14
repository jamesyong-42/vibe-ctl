/**
 * Utility-process host for split plugins (spec 01 §4).
 *
 * A "split" plugin has a `main.js` entry that runs in Electron's
 * `utilityProcess`, isolated from the renderer. The plugin host asks this
 * module to spawn a utilityProcess per split plugin; the fork result is
 * wired to the plugin's `ctx.ipc` channel.
 *
 * Stub: spawn shape only — the plugin host protocol hook is not yet
 * implemented upstream in `@vibe-ctl/runtime`.
 */

import { type UtilityProcess, utilityProcess } from 'electron';

export interface UtilityProcessHandle {
  readonly pluginId: string;
  readonly child: UtilityProcess;
  kill(): void;
}

export function spawnPluginProcess(pluginId: string, entryPath: string): UtilityProcessHandle {
  const child = utilityProcess.fork(entryPath, [], {
    serviceName: `vibe-ctl-plugin-${pluginId}`,
    stdio: 'pipe',
  });

  return {
    pluginId,
    child,
    kill() {
      child.kill();
    },
  };
}
