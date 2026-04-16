/**
 * Log forwarder (spec 05 §5.1).
 *
 * Renderer code calls `__vibeCtl.log(level, scope, msg, meta?)`. Each
 * call is forwarded to main via `ipcRenderer.send('vibe-ctl:log', …)`
 * where a scoped pino child re-emits it into the main process log
 * stream (which in turn writes `main.log` + — in dev — pretty-prints
 * to stdout). That means one file captures everything: main, forwarded
 * kernel, and every renderer's traffic, with matching `scope` fields.
 *
 * In dev we also echo to the renderer DevTools console so frontend
 * devs keep their inline feedback. In production packaged builds the
 * DevTools is closed by default, so the echo has no cost.
 */

import { ipcRenderer } from 'electron';

export type LogLevel = 'trace' | 'debug' | 'info' | 'warn' | 'error' | 'fatal';

const IPC_CHANNEL = 'vibe-ctl:log' as const;

// Preload runs under `sandbox: true` with `contextIsolation: true`, so
// we read NODE_ENV from the limited `process` polyfill Electron exposes.
// `process.env.NODE_ENV` is `'development'` under electron-vite dev, empty
// in packaged builds.
const IS_DEV = process.env.NODE_ENV !== 'production';

function consoleEcho(level: LogLevel, scope: string, msg: string, meta?: unknown): void {
  const fn =
    level === 'trace' || level === 'debug'
      ? console.debug
      : level === 'info'
        ? console.info
        : level === 'warn'
          ? console.warn
          : console.error;
  if (meta === undefined) fn(`[${scope}] ${msg}`);
  else fn(`[${scope}] ${msg}`, meta);
}

export function log(level: LogLevel, scope: string, msg: string, meta?: unknown): void {
  try {
    ipcRenderer.send(IPC_CHANNEL, { level, scope, msg, meta });
  } catch {
    // If the channel is gone (e.g. main is tearing down), fall back to
    // the DevTools console so the message isn't silently swallowed.
    consoleEcho('error', scope, `[ipc-log-send-failed] ${msg}`, meta);
    return;
  }
  if (IS_DEV) consoleEcho(level, scope, msg, meta);
}
