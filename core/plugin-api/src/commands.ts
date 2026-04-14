import type { Disposable } from './disposable.js';

/**
 * A command registered via `ctx.commands.register()`. Commands are the
 * unit of action surfaced to the command palette, keybindings, and
 * menus.
 */
export interface CommandDef<Args extends unknown[] = unknown[], Result = unknown> {
  /** Globally unique. Convention: `{pluginId}.{verb}`. */
  id: string;
  /** Short human-readable label shown in the palette. */
  title: string;
  /** Optional longer description shown when highlighted. */
  description?: string;
  /** Optional icon name (resolved by the UI theme). */
  icon?: string;
  /** Optional category used to group commands in the palette. */
  category?: string;
  /**
   * The command implementation. The runtime forwards args and awaits
   * the return value for feedback purposes.
   */
  run(...args: Args): Result | Promise<Result>;
}

/**
 * Surface exposed via `ctx.commands`.
 */
export interface CommandRegistry {
  register<Args extends unknown[] = unknown[], Result = unknown>(
    def: CommandDef<Args, Result>,
  ): Disposable;
  /** Execute a previously-registered command by id. */
  execute<Result = unknown>(id: string, ...args: unknown[]): Promise<Result>;
}

/**
 * Keybinding registry exposed via `ctx.keybindings`. Bindings reference
 * a command by id.
 */
export interface KeybindingRegistry {
  register(binding: {
    commandId: string;
    /** Electron-accelerator string, e.g. `CmdOrCtrl+Shift+P`. */
    accelerator: string;
    /** Optional `when` expression, e.g. `canvasFocused`. */
    when?: string;
  }): Disposable;
}

/**
 * Menu registry exposed via `ctx.menus`. Contributes items to named
 * menu locations (app menu, context menus).
 */
export interface MenuRegistry {
  register(item: {
    /** Menu location, e.g. `app/file`, `canvas/context`, `widget/{type}`. */
    location: string;
    commandId: string;
    /** Optional group used to cluster related items. */
    group?: string;
    /** Sort order within the group. */
    order?: number;
    /** Optional `when` expression. */
    when?: string;
  }): Disposable;
}

/**
 * Theme registry exposed via `ctx.themes`. Kernel renders themes through
 * its own theming pipeline; the plugin just supplies tokens.
 */
export interface ThemeRegistry {
  register(theme: {
    id: string;
    label: string;
    kind: 'light' | 'dark' | 'high-contrast';
    tokens: Record<string, string>;
  }): Disposable;
}
