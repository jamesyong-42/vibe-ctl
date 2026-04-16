/**
 * CommandRegistry.
 *
 * Plugins register commands via `ctx.commands.register(...)`; commands can
 * be invoked from the command palette, keybindings, menus, or
 * `ctx.commands.execute()`. Executing a command for a lazy plugin is one
 * of the first-use activation triggers (spec 01 §10).
 */

import type { Disposable, Logger } from '@vibe-ctl/plugin-api';

export interface CommandDef {
  id: string;
  title: string;
  description?: string;
  icon?: string;
  category?: string;
  ownerPluginId: string;
  handler: (...args: unknown[]) => unknown;
}

export class CommandRegistry {
  readonly #commands = new Map<string, CommandDef>();
  readonly #logger: Logger | undefined;

  constructor(opts?: { logger?: Logger }) {
    this.#logger = opts?.logger;
  }

  /** Register a command. Returns a Disposable that removes it. */
  register(def: CommandDef): Disposable {
    if (this.#commands.has(def.id)) {
      this.#logger?.warn({ commandId: def.id }, 'command already registered — overwriting');
    }
    this.#commands.set(def.id, def);

    return {
      dispose: () => {
        // Only remove if this is still the same registration.
        if (this.#commands.get(def.id) === def) {
          this.#commands.delete(def.id);
        }
      },
    };
  }

  /** Execute a previously-registered command by id. */
  async execute(id: string, ...args: unknown[]): Promise<unknown> {
    const def = this.#commands.get(id);
    if (!def) {
      throw new Error(`Command not found: ${id}`);
    }
    return def.handler(...args);
  }

  /** Check if a command is registered. */
  has(id: string): boolean {
    return this.#commands.has(id);
  }

  /** List all registered commands. */
  getAll(): CommandDef[] {
    return Array.from(this.#commands.values());
  }

  /** Alias for getAll() — backward compat. */
  list(): CommandDef[] {
    return this.getAll();
  }
}
