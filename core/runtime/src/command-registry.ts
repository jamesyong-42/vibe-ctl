/**
 * CommandRegistry.
 *
 * Plugins register commands via `ctx.commands.register(...)`; commands can
 * be invoked from the command palette, keybindings, menus, or
 * `ctx.commands.execute()`. Executing a command for a lazy plugin is one
 * of the first-use activation triggers (spec 01 §10).
 */

import type { Disposable } from '@vibe-ctl/extension-api';

export interface CommandDef {
  id: string;
  title: string;
  ownerPluginId: string;
  handler: (...args: unknown[]) => unknown;
}

export class CommandRegistry {
  readonly #commands = new Map<string, CommandDef>();

  register(_def: CommandDef): Disposable {
    throw new Error('not implemented: CommandRegistry.register');
  }

  async execute(_id: string, ..._args: unknown[]): Promise<unknown> {
    throw new Error('not implemented: CommandRegistry.execute');
  }

  list(): CommandDef[] {
    return Array.from(this.#commands.values());
  }
}
