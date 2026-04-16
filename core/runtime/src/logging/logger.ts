/**
 * Structured logger for the runtime.
 *
 * One root pino instance per process; every module gets a child via
 * `createScopedLogger(scope)` so logs carry `{ scope }` automatically.
 *
 * ## Root logger swapping
 *
 * Process entrypoints (shell main, kernel utility) can install a
 * file-backed root via `setRootLogger()` — see `createLogger()`. Because
 * `createScopedLogger` is called at module-scope in many files (before
 * the entrypoint has a chance to swap roots), scoped loggers are
 * **live** proxies: every method invocation re-derives the child off the
 * current root. Swapping the root therefore picks up instantly across
 * every already-created scoped logger. This keeps the ~30 existing
 * `createScopedLogger` callsites working without API change.
 *
 * ## On-disk layout (spec 05 §12)
 *
 * Entrypoints call `createLogger({ logDir, filename, stdoutInDev })`
 * and install the result via `setRootLogger`. Today's producers:
 *
 *   - `main.log`   — shell main process. Also receives forwarded
 *                    kernel-utility errors/warnings (via supervisor) and
 *                    forwarded renderer console logs (via preload).
 *   - `kernel.log` — kernel utility process. Only direct writes; bulk
 *                    of events live here, not duplicated to main.log.
 *   - `plugins/{pluginId}.log` — split-plugin utilities (Phase 6).
 *
 * Production: raw JSON to stdout (unless the entrypoint installed a
 * rotating file root).
 *
 * Development: `pino-pretty` transport when available. We probe for it
 * lazily and fall back to raw JSON if it isn't resolvable — the kernel
 * utility process may not have `pino-pretty` on its resolution path and
 * we don't want logger construction to throw.
 *
 * ## Per-scope log levels — `LOG_LEVEL_SCOPES`
 *
 * Fine-grained log noise control without recompiling. Syntax:
 *
 *     LOG_LEVEL_SCOPES=shell:kernel=trace,doc-router=debug,*=info
 *
 * Rules:
 *   - Entries are comma-separated; each entry is `glob=level`.
 *   - Plain strings match exactly (e.g. `doc-router=debug` only fires
 *     for `createScopedLogger('doc-router')`).
 *   - A trailing `*` means prefix match (`shell:*` matches `shell:foo`,
 *     `shell:foo:bar`). The `*` alone is the default for all scopes.
 *   - When both a prefix rule and an exact rule apply, the more specific
 *     (longer) prefix wins; exact beats any prefix.
 *   - Fallback order: scope-specific rule → `*` default → `LOG_LEVEL`
 *     env var → pino default.
 *
 * Level values: one of `trace|debug|info|warn|error|fatal|silent`.
 */

import { createRequire } from 'node:module';
import { join } from 'node:path';
import { type Logger, pino, type TransportTargetOptions } from 'pino';

export type LogLevel = 'trace' | 'debug' | 'info' | 'warn' | 'error' | 'fatal' | 'silent';

const VALID_LEVELS: ReadonlySet<string> = new Set<string>([
  'trace',
  'debug',
  'info',
  'warn',
  'error',
  'fatal',
  'silent',
]);

interface ScopeLevelRules {
  exact: Map<string, LogLevel>;
  /** Prefix (without trailing `*`) → level. */
  prefix: Map<string, LogLevel>;
  defaultLevel?: LogLevel;
}

/**
 * Parse a `LOG_LEVEL_SCOPES` value into a lookup structure. Tolerates
 * whitespace around entries and silently drops malformed/invalid rules
 * (with no crash) — environment parsing should never refuse to boot.
 */
export function parseScopeLevels(raw: string | undefined): ScopeLevelRules {
  const exact = new Map<string, LogLevel>();
  const prefix = new Map<string, LogLevel>();
  let defaultLevel: LogLevel | undefined;
  if (!raw) return { exact, prefix, defaultLevel };

  for (const rawEntry of raw.split(',')) {
    const entry = rawEntry.trim();
    if (!entry) continue;
    const eq = entry.indexOf('=');
    if (eq < 0) continue;
    const lhs = entry.slice(0, eq).trim();
    const rhs = entry
      .slice(eq + 1)
      .trim()
      .toLowerCase();
    if (!lhs || !VALID_LEVELS.has(rhs)) continue;
    const level = rhs as LogLevel;

    if (lhs === '*') {
      defaultLevel = level;
    } else if (lhs.endsWith('*')) {
      prefix.set(lhs.slice(0, -1), level);
    } else {
      exact.set(lhs, level);
    }
  }
  return { exact, prefix, defaultLevel };
}

/**
 * Look up the configured level for a given scope.
 * Exact match > longest prefix match > default > undefined (caller decides).
 */
function lookupScopeLevel(rules: ScopeLevelRules, scope: string): LogLevel | undefined {
  const exact = rules.exact.get(scope);
  if (exact) return exact;

  let bestPrefix: string | null = null;
  let bestLevel: LogLevel | undefined;
  for (const [p, level] of rules.prefix) {
    if (scope.startsWith(p) && (bestPrefix === null || p.length > bestPrefix.length)) {
      bestPrefix = p;
      bestLevel = level;
    }
  }
  if (bestLevel) return bestLevel;
  return rules.defaultLevel;
}

const scopeRules: ScopeLevelRules = parseScopeLevels(process.env.LOG_LEVEL_SCOPES);

function tryResolvePinoPretty(): boolean {
  try {
    createRequire(import.meta.url).resolve('pino-pretty');
    return true;
  } catch {
    return false;
  }
}

function createDefaultRootLogger(): Logger {
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

/**
 * Build a `pino-roll` transport config targeting `{logDir}/{filename}`
 * with daily rotation, 10MiB max per file, 7-day retention.
 */
export function createRotatingTransport(logDir: string, filename: string): TransportTargetOptions {
  return {
    target: 'pino-roll',
    level: 'trace',
    options: {
      file: join(logDir, filename),
      frequency: 'daily',
      mkdir: true,
      size: '10m',
      limit: { count: 7 },
    },
  };
}

export interface CreateLoggerOptions {
  /**
   * Target directory for rotating file output. When omitted (CI, tests)
   * the returned logger writes to stdout only.
   */
  logDir?: string;
  /** Filename inside `logDir` (e.g. `main.log`, `kernel.log`). */
  filename: string;
  /**
   * In dev, also emit to stdout via `pino-pretty`. Ignored in prod
   * (utility processes keep stdout for supervisor forwarding).
   */
  stdoutInDev?: boolean;
}

/**
 * Build a root pino logger configured for the given process.
 *
 *  - `logDir` + `filename` set → rotating file via `pino-roll`.
 *  - dev + `stdoutInDev` → pino-pretty stdout stream is combined
 *    alongside the file via a multistream transport.
 *  - prod → file only (stdout is already piped by the supervisor for
 *    utility processes; main process uses file for durability).
 *  - no `logDir` → stdout only; behaves like the default root.
 *
 * Callers are expected to follow up with `setRootLogger(result)` so
 * existing scoped loggers start routing to the new root.
 */
export function createLogger(opts: CreateLoggerOptions): Logger {
  const isDev = process.env.NODE_ENV !== 'production';
  const level = process.env.LOG_LEVEL ?? (isDev ? 'debug' : 'info');

  if (!opts.logDir) {
    // Fall back to stdout-only — matches `createDefaultRootLogger` but
    // without re-evaluating env vars inconsistently.
    if (isDev && tryResolvePinoPretty()) {
      return pino({
        level,
        transport: {
          target: 'pino-pretty',
          options: { colorize: true, translateTime: 'SYS:HH:MM:ss.l' },
        },
      });
    }
    return pino({ level });
  }

  const fileTarget = createRotatingTransport(opts.logDir, opts.filename);
  const targets: TransportTargetOptions[] = [fileTarget];

  if (isDev && opts.stdoutInDev && tryResolvePinoPretty()) {
    targets.push({
      target: 'pino-pretty',
      level: 'trace',
      options: { colorize: true, translateTime: 'SYS:HH:MM:ss.l' },
    });
  }
  // In production the file is authoritative; we deliberately drop the
  // stdout target so supervisor re-parsing doesn't duplicate every line
  // into main.log. Stderr from native crashes still reaches the
  // supervisor outside of pino (which is the whole point of forwarding).

  return pino({
    level,
    transport: { targets },
  });
}

let rootLoggerRef: Logger = createDefaultRootLogger();

/**
 * Process-wide root logger. Exported as a live proxy — if an entrypoint
 * calls `setRootLogger()` later, this reference picks up the new root
 * instantly.
 */
export const rootLogger: Logger = new Proxy({} as Logger, {
  get(_, prop) {
    const value = Reflect.get(rootLoggerRef, prop);
    return typeof value === 'function' ? value.bind(rootLoggerRef) : value;
  },
  set(_, prop, value) {
    return Reflect.set(rootLoggerRef, prop, value);
  },
});

/**
 * Swap the process-wide root logger. Intended for process entrypoints
 * (shell main, kernel utility) to install a file-backed root. Every
 * already-created scoped logger routes through `rootLoggerRef` lazily,
 * so the swap takes effect immediately with no refactor needed.
 */
export function setRootLogger(next: Logger): void {
  rootLoggerRef = next;
}

/**
 * Create a child logger tagged with `{ scope }`. The returned logger is
 * a **live proxy**: calls are forwarded to a fresh `rootLoggerRef.child`
 * on each invocation, so roots swapped after module-init still take
 * effect. A scope-level override from `LOG_LEVEL_SCOPES` is applied on
 * every child construction (cheap — the child constructor is a plain
 * prototype chain).
 */
export function createScopedLogger(scope: string): Logger {
  const override = lookupScopeLevel(scopeRules, scope);
  let cachedRoot: Logger | null = null;
  let cachedChild: Logger | null = null;

  const current = (): Logger => {
    if (cachedRoot !== rootLoggerRef || cachedChild === null) {
      cachedRoot = rootLoggerRef;
      cachedChild = rootLoggerRef.child({ scope });
      if (override) cachedChild.level = override;
    }
    return cachedChild;
  };

  return new Proxy({} as Logger, {
    get(_, prop) {
      const target = current();
      const value = Reflect.get(target, prop);
      return typeof value === 'function' ? value.bind(target) : value;
    },
    set(_, prop, value) {
      return Reflect.set(current(), prop, value);
    },
  });
}
