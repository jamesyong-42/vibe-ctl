/**
 * Renderer → main log bridge (spec 05 §5.1).
 *
 * Preload sends `vibe-ctl:log` messages via `ipcRenderer.send`. This
 * receiver validates the envelope, maps the sender's `webContents.id`
 * to a scope (`renderer:<id>`), and re-emits through a pino child at
 * the caller's declared level. Result: everything the renderer logs
 * lands in `main.log` alongside main's own scopes, one file, one
 * consistent format.
 */

import { createScopedLogger } from '@vibe-ctl/runtime';
import { ipcMain } from 'electron';

const LOG_CHANNEL = 'vibe-ctl:log' as const;

type Level = 'trace' | 'debug' | 'info' | 'warn' | 'error' | 'fatal';

const VALID_LEVELS: ReadonlySet<Level> = new Set<Level>([
  'trace',
  'debug',
  'info',
  'warn',
  'error',
  'fatal',
]);

interface LogPayload {
  level: Level;
  scope: string;
  msg: string;
  meta?: unknown;
}

function parsePayload(raw: unknown): LogPayload | null {
  if (!raw || typeof raw !== 'object') return null;
  const obj = raw as Record<string, unknown>;
  if (typeof obj.level !== 'string' || !VALID_LEVELS.has(obj.level as Level)) return null;
  if (typeof obj.scope !== 'string' || typeof obj.msg !== 'string') return null;
  return { level: obj.level as Level, scope: obj.scope, msg: obj.msg, meta: obj.meta };
}

// One logger per sender webContents id — amortises the child-logger
// construction cost across every log call from a given window.
const loggerCache = new Map<number, ReturnType<typeof createScopedLogger>>();

function getLoggerForSender(senderId: number): ReturnType<typeof createScopedLogger> {
  const cached = loggerCache.get(senderId);
  if (cached) return cached;
  const fresh = createScopedLogger(`renderer:${senderId}`);
  loggerCache.set(senderId, fresh);
  return fresh;
}

const selfLog = createScopedLogger('shell:ipc:log-receiver');

export function setupLogReceiver(): void {
  ipcMain.on(LOG_CHANNEL, (event, raw: unknown) => {
    const parsed = parsePayload(raw);
    if (!parsed) {
      selfLog.warn({ raw }, 'rejected malformed renderer log payload');
      return;
    }
    const log = getLoggerForSender(event.sender.id);
    // Tag with the renderer-side scope so a single line carries
    // `scope: 'renderer:7'` + `rendererScope: 'EventStreamProvider'`.
    const context = { rendererScope: parsed.scope, meta: parsed.meta };
    log[parsed.level](context, parsed.msg);
  });
}
