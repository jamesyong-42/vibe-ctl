/**
 * ContextBuilder. Constructs a `PluginContext` for each plugin at
 * activation time. Spec 01 §5.
 *
 * The context is scoped to one plugin: disposables auto-track to the
 * DisposableTracker under that plugin's ID, `ctx.logger` is scoped to the
 * plugin, `ctx.signal` aborts on deactivation, and the sync/mesh façades
 * auto-namespace wire traffic with the plugin ID (so no plugin can
 * impersonate another).
 */

import type {
  Disposable,
  Logger,
  PluginContext,
  PluginTier,
  WidgetDef,
} from '@vibe-ctl/plugin-api';
import type { PermissionManager } from '../permission-manager.js';
import type { CommandRegistry } from '../registries/command-registry.js';
import type { ServiceRegistry } from '../registries/service-registry.js';
import type { WidgetTypeRegistry } from '../registries/widget-type-registry.js';
import type { SettingsManager } from '../settings-manager.js';
import type { KernelDocs } from '../sync/kernel-docs.js';
import type { MeshNode } from '../sync/mesh-node.js';
import type { DisposableTracker } from './disposable-tracker.js';

export interface ContextBuilderOptions {
  mesh: MeshNode;
  docs: KernelDocs;
  services: ServiceRegistry;
  commands: CommandRegistry;
  widgets: WidgetTypeRegistry;
  settings: SettingsManager;
  permissions: PermissionManager;
  tracker: DisposableTracker;
  /** Root dir for per-plugin persistent storage. */
  pluginDataDir: (pluginId: string) => string;
  /** Root logger; scoped per plugin. */
  baseLogger: Logger;
  deviceId: string;
  deviceName: string;
}

/** Per-plugin AbortController; stored so the deactivation system can abort it. */
const abortControllers = new Map<string, AbortController>();

/** Retrieve the AbortController for a plugin (used by the deactivation system). */
export function getPluginAbortController(pluginId: string): AbortController | undefined {
  return abortControllers.get(pluginId);
}

/** Remove the AbortController after deactivation cleanup. */
export function removePluginAbortController(pluginId: string): void {
  abortControllers.delete(pluginId);
}

function notImplemented(name: string): never {
  throw new Error(`Not implemented: ctx.${name} (stub — wired in a later phase)`);
}

export class ContextBuilder {
  readonly #opts: ContextBuilderOptions;

  constructor(opts: ContextBuilderOptions) {
    this.#opts = opts;
  }

  /**
   * Build a `PluginContext` for a specific plugin. The tier is passed in
   * rather than read from ECS so this method is cheap and side-effect-free.
   *
   * Phase 3 populates: id, version, tier, dataDir, logger, signal, track().
   * Registration APIs (widgets, commands, keybindings, menus, themes) and
   * kernel surfaces (canvas, sync, mesh, rpc, settings, storage, ui,
   * permissions) are stubbed with NotImplemented for now. Later phases
   * fill them in as the underlying registries are wired.
   */
  build(pluginId: string, version: string, tier: PluginTier): PluginContext {
    const opts = this.#opts;
    const dataDir = opts.pluginDataDir(pluginId);
    const logger = createPluginLogger(opts.baseLogger, pluginId);

    const ac = new AbortController();
    abortControllers.set(pluginId, ac);

    const tracker = opts.tracker;

    const ctx: PluginContext = Object.freeze({
      // Identity
      id: pluginId,
      version,
      tier,
      dataDir,
      logger,
      signal: ac.signal,

      // Resource tracking
      track<T extends Disposable>(d: T): T {
        return tracker.track(pluginId, d) as T;
      },

      // Registration APIs — widgets, commands wired; others stubbed
      widgets: {
        register<Config = unknown>(def: WidgetDef<Config>) {
          const disposable = opts.widgets.register(def);
          return tracker.track(pluginId, disposable);
        },
      },
      commands: {
        register(def: {
          id: string;
          title: string;
          description?: string;
          icon?: string;
          category?: string;
          run(...args: never[]): unknown;
        }) {
          const disposable = opts.commands.register({
            id: def.id,
            title: def.title,
            description: def.description,
            icon: def.icon,
            category: def.category,
            ownerPluginId: pluginId,
            handler: (...args: unknown[]) => def.run(...(args as never[])),
          });
          return tracker.track(pluginId, disposable);
        },
        execute: (id: string, ...args: unknown[]) => opts.commands.execute(id, ...args),
      } as PluginContext['commands'],
      get keybindings(): never {
        return notImplemented('keybindings');
      },
      get menus(): never {
        return notImplemented('menus');
      },
      get themes(): never {
        return notImplemented('themes');
      },

      // Event bus — stubbed
      on(): never {
        return notImplemented('on');
      },
      emit(): never {
        return notImplemented('emit');
      },

      // Services — wired to registry
      services: {
        provide: (
          id: string,
          impl: unknown,
          provideOpts?: { warmup?: Promise<void>; tierRestriction?: PluginTier },
        ) => {
          const disposable = opts.services.provide(id, impl, provideOpts, pluginId);
          return tracker.track(pluginId, disposable);
        },
        require: (id: string) => opts.services.require(id),
        optional: (id: string) => opts.services.optional(id),
      } as PluginContext['services'],

      // Kernel surfaces — stubbed
      get canvas(): never {
        return notImplemented('canvas');
      },
      get sync(): never {
        return notImplemented('sync');
      },
      get mesh(): never {
        return notImplemented('mesh');
      },

      rpc: undefined,

      get settings(): never {
        return notImplemented('settings');
      },
      get storage(): never {
        return notImplemented('storage');
      },
      get ui(): never {
        return notImplemented('ui');
      },
      get permissions(): never {
        return notImplemented('permissions');
      },
    });

    return ctx;
  }

  /** Access the wired options (used by a small number of sibling modules). */
  get options(): Readonly<ContextBuilderOptions> {
    return this.#opts;
  }
}

/**
 * Create a scoped plugin logger. Uses the pino-compatible interface
 * from @vibe-ctl/plugin-api's Logger type.
 */
function createPluginLogger(base: Logger, pluginId: string): Logger {
  // The base logger from runtime is a pino instance with .child().
  // We use a thin wrapper that prefixes messages with the plugin id.
  const prefix = `[plugin:${pluginId}]`;
  return {
    trace(...args: unknown[]) {
      if (typeof args[0] === 'object' && args[0] !== null) {
        base.trace(args[0] as object, `${prefix} ${args[1]}`);
      } else {
        base.trace(`${prefix} ${args[0]}`);
      }
    },
    debug(...args: unknown[]) {
      if (typeof args[0] === 'object' && args[0] !== null) {
        base.debug(args[0] as object, `${prefix} ${args[1]}`);
      } else {
        base.debug(`${prefix} ${args[0]}`);
      }
    },
    info(...args: unknown[]) {
      if (typeof args[0] === 'object' && args[0] !== null) {
        base.info(args[0] as object, `${prefix} ${args[1]}`);
      } else {
        base.info(`${prefix} ${args[0]}`);
      }
    },
    warn(...args: unknown[]) {
      if (typeof args[0] === 'object' && args[0] !== null) {
        base.warn(args[0] as object, `${prefix} ${args[1]}`);
      } else {
        base.warn(`${prefix} ${args[0]}`);
      }
    },
    error(...args: unknown[]) {
      if (typeof args[0] === 'object' && args[0] !== null) {
        base.error(args[0] as object, `${prefix} ${args[1]}`);
      } else {
        base.error(`${prefix} ${args[0]}`);
      }
    },
  } as Logger;
}
