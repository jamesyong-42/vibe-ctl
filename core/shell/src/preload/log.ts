/**
 * Log forwarder (spec 05 §5.1).
 *
 * Renderer code calls `__vibeCtl.log(level, scope, msg, meta?)` and this
 * module forwards to main's pino. Phase-1: no main-side receiver is
 * wired yet, so we log to the renderer console with a scope prefix so
 * devs can still see output in DevTools. Phase 2 adds the real
 * `ipcMain.on('vibe-ctl:log', …)` sink.
 */

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

export function log(level: LogLevel, scope: string, msg: string, meta?: unknown): void {
  // TODO(phase-2): forward via ipcRenderer.send('vibe-ctl:log', {...}).
  const fn =
    level === 'debug'
      ? // biome-ignore lint/suspicious/noConsole: renderer log fallback
        console.debug
      : level === 'info'
        ? // biome-ignore lint/suspicious/noConsole: renderer log fallback
          console.info
        : level === 'warn'
          ? // biome-ignore lint/suspicious/noConsole: renderer log fallback
            console.warn
          : // biome-ignore lint/suspicious/noConsole: renderer log fallback
            console.error;
  if (meta === undefined) fn(`[${scope}] ${msg}`);
  else fn(`[${scope}] ${msg}`, meta);
}
