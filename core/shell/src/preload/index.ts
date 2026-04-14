/**
 * Preload script.
 *
 * Runs in an isolated context with Node access. We only expose a narrow,
 * typed surface to the renderer via `contextBridge`. Keeping the surface
 * small is the sandbox escape hatch — never expose `ipcRenderer` directly.
 */

import { contextBridge } from 'electron';

// The typed host surface. Grows as kernel IPC channels are defined.
const vibeCtl = {
  platform: process.platform,
  versions: process.versions,
  // TODO: expose IPC-backed host APIs here
  //   - runtime.queryPlugins()
  //   - runtime.enablePlugin(id) / disablePlugin(id)
  //   - canvas.registerWidgetType / unregisterWidgetType
  //   - permissions.requestGrant / revokeGrant
  //   - windows.detachWidget(widgetId)
} as const;

export type VibeCtlPreload = typeof vibeCtl;

contextBridge.exposeInMainWorld('__vibeCtl', vibeCtl);

declare global {
  interface Window {
    __vibeCtl: VibeCtlPreload;
  }
}
