import { Plugin } from '@vibe-ctl/plugin-api';
import { CommandPaletteWidget } from './widgets/CommandPaletteWidget';

/**
 * Command Palette plugin.
 *
 * Registers the Cmd+K keybinding, mounts the palette widget on the
 * dedicated `command-palette` placement, and renders commands
 * registered by any plugin through `ctx.commands`.
 */
export default class CommandPalettePlugin extends Plugin {
  async onActivate(): Promise<void> {
    // TODO: this.ctx.keybindings.register({ key: 'mod+k', command: 'palette.open' });
    // TODO: this.ctx.commands.register({ id: 'palette.open', handler: () => this.open() });

    this.ctx.widgets.register({
      type: 'command-palette',
      component: CommandPaletteWidget,
      ownedByPlugin: this.ctx.id,
      placements: ['command-palette'],
      defaultSize: { width: 560, height: 480 },
    });
  }
}
