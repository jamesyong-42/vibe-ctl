import { Plugin } from '@vibe-ctl/plugin-api';
import { ThemePickerWidget } from './widgets/ThemePickerWidget';

/**
 * Themes plugin.
 *
 * Registers the default light/dark themes, provides the `themes`
 * service for other plugins to contribute themes, and mounts a
 * theme-picker widget.
 */
export default class ThemesPlugin extends Plugin {
  async onActivate(): Promise<void> {
    // TODO: this.ctx.themes.register({ id: 'vibe-dark', tokens: { ... } });
    // TODO: this.ctx.themes.register({ id: 'vibe-light', tokens: { ... } });
    // TODO: this.ctx.services.provide('themes', facade);

    this.ctx.widgets.register({
      type: 'theme-picker',
      component: ThemePickerWidget,
      ownedByPlugin: this.ctx.id,
      placements: ['side-panel:left', 'side-panel:right'],
      defaultSize: { width: 280, height: 400 },
    });
  }
}
