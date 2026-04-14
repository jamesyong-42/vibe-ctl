import type {
  CommandRegistry,
  KeybindingRegistry,
  MenuRegistry,
  ThemeRegistry,
} from './commands.js';
import type { Disposable } from './disposable.js';
import type { VibeEvents } from './events.js';
import type { MeshAPI } from './mesh.js';
import type { PermissionAPI } from './permissions.js';
import type { PluginRPC } from './rpc.js';
import type { ServiceRegistry } from './services/registry.js';
import type { SyncAPI } from './sync.js';
import type { Logger, PluginTier, Point, Size } from './types.js';
import type { UI } from './ui.js';
import type { WidgetPlacement, WidgetRegistry } from './widgets.js';

/**
 * High-level canvas shortcut for plugins. Writes go through the
 * `kernel/canvas-layout` CRDT; see spec 02 §4.
 */
export interface CanvasAPI {
  /** Add a widget to the canvas. Returns the new widget's id. */
  addWidget(opts: {
    type: string;
    placement: WidgetPlacement;
    position?: Point;
    size?: Size;
    config?: unknown;
    parentId?: string;
  }): Promise<string>;

  /** Update a widget's position, size, or config. Partial. */
  updateWidget(
    widgetId: string,
    patch: { position?: Point; size?: Size; config?: unknown },
  ): Promise<void>;

  /** Remove a widget from the canvas. */
  removeWidget(widgetId: string): Promise<void>;

  /** Move the viewport to a given point (no animation guarantee). */
  panTo(point: Point): void;

  /** Set the viewport zoom. */
  setZoom(zoom: number): void;
}

/**
 * User-global settings API. Backed by the `kernel/user-settings` CRDT
 * and auto-scoped to the plugin's namespace.
 */
export interface SettingsAPI {
  get<T = unknown>(key: string): T | undefined;
  set<T = unknown>(key: string, value: T): Promise<void>;
  update<T = unknown>(key: string, updater: (current: T | undefined) => T): Promise<void>;
  onChange(cb: (key: string, value: unknown) => void): Disposable;
}

/**
 * Per-plugin, local-only key-value store. Not synced. Good for caches,
 * device-specific state, and anything too transient or sensitive to sync.
 */
export interface StorageAPI {
  get<T = unknown>(key: string): Promise<T | undefined>;
  set<T = unknown>(key: string, value: T): Promise<void>;
  delete(key: string): Promise<void>;
  keys(): Promise<string[]>;
  clear(): Promise<void>;
}

/**
 * The `ctx` object injected into every plugin. Scoped to that plugin;
 * disposables are auto-tracked and disposed on deactivation. See
 * spec 01 §5.
 */
export interface PluginContext {
  // Identity
  readonly id: string;
  readonly version: string;
  readonly tier: PluginTier;
  /** Plugin's persistent local storage directory. */
  readonly dataDir: string;
  /** Scoped logger; output visible in the plugin dev panel. */
  readonly logger: Logger;
  /** Aborts on deactivate. Pass to `fetch`, async loops, etc. */
  readonly signal: AbortSignal;

  /** Track a disposable so it cleans up on deactivate. */
  track<T extends Disposable>(d: T): T;

  // Registration APIs
  widgets: WidgetRegistry;
  commands: CommandRegistry;
  keybindings: KeybindingRegistry;
  menus: MenuRegistry;
  themes: ThemeRegistry;

  // Event bus (typed via VibeEvents)
  on<E extends keyof VibeEvents>(event: E, handler: (p: VibeEvents[E]) => void): Disposable;
  emit<E extends keyof VibeEvents>(event: E, payload: VibeEvents[E]): void;

  // Services
  services: ServiceRegistry;

  // Kernel surfaces
  canvas: CanvasAPI;
  sync: SyncAPI;
  mesh: MeshAPI;

  /** Present only in split plugins (manifest `executionContext: 'split'`). */
  rpc?: PluginRPC;

  settings: SettingsAPI;
  storage: StorageAPI;

  ui: UI;
  permissions: PermissionAPI;
}
