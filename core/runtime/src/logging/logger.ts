/**
 * Structured logger for the runtime.
 *
 * One root pino instance per process; every module gets a child via
 * `createScopedLogger(scope)` so logs carry `{ scope }` automatically.
 *
 * Production: raw JSON to stdout. Main-process shell code collects
 * stdout/stderr from the kernel utility and split-plugin utilities and
 * pipes it into its own log file rotation (Phase 1 — not here).
 *
 * Development: `pino-pretty` transport when available. We probe for it
 * lazily and fall back to raw JSON if it isn't resolvable — the kernel
 * utility process may not have `pino-pretty` on its resolution path and
 * we don't want logger construction to throw.
 */

import { createRequire } from 'node:module';
import { type Logger, pino } from 'pino';

function tryResolvePinoPretty(): boolean {
  try {
    createRequire(import.meta.url).resolve('pino-pretty');
    return true;
  } catch {
    return false;
  }
}

function createRootLogger(): Logger {
  const isDev = process.env.NODE_ENV !== 'production';
  if (!isDev) {
    return pino({ level: process.env.LOG_LEVEL ?? 'info' });
  }

  if (tryResolvePinoPretty()) {
    return pino({
      level: process.env.LOG_LEVEL ?? 'debug',
      transport: {
        target: 'pino-pretty',
        options: { colorize: true, translateTime: 'SYS:HH:MM:ss.l' },
      },
    });
  }

  return pino({ level: process.env.LOG_LEVEL ?? 'debug' });
}

/** Process-wide root logger. */
export const rootLogger: Logger = createRootLogger();

/** Create a child logger tagged with `{ scope }`. */
export function createScopedLogger(scope: string): Logger {
  return rootLogger.child({ scope });
}
