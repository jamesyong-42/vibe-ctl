import { Plugin } from '@vibe-ctl/plugin-api';
import type { DynamicIslandMainApi } from './main';
import { DynamicIslandStatusWidget } from './widgets/DynamicIslandStatusWidget';

/**
 * Dynamic Island renderer-half plugin.
 *
 * Observes agent + approval events and mirrors them to the NotchHelper
 * child via the main-half RPC. Renders a small status widget for
 * diagnostics in the main window.
 */
export default class DynamicIslandRenderer extends Plugin {
  async onActivate(): Promise<void> {
    const main = this.ctx.rpc?.connect<DynamicIslandMainApi>();
    if (!main) {
      throw new Error('dynamic-island renderer requires ctx.rpc');
    }

    // TODO: subscribe to claude-code hook + notifications service
    //       and call main.setState(...) on relevant changes.

    this.ctx.widgets.register({
      type: 'dynamic-island-status',
      component: DynamicIslandStatusWidget,
      ownedByPlugin: this.ctx.id,
      placements: ['status-bar:right'],
      defaultSize: { width: 160, height: 32 },
    });
  }
}
