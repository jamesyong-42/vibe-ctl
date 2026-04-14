import { Plugin } from '@vibe-ctl/extension-api';
import { QuickActionsWidget } from './widgets/QuickActionsWidget';

/**
 * Quick Actions plugin.
 *
 * Registers a single grid widget with pinnable shortcuts that call
 * into optional services (claude-code, terminal). Missing services
 * gracefully disable their respective actions.
 */
export default class QuickActionsPlugin extends Plugin {
  async onActivate(): Promise<void> {
    this.ctx.widgets.register({
      type: 'quick-actions',
      component: QuickActionsWidget,
      ownedByPlugin: this.ctx.id,
      placements: ['canvas', 'side-panel:right', 'status-bar:left'],
      defaultSize: { width: 240, height: 160 },
    });
  }
}
