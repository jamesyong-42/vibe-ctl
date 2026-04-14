import { Plugin } from '@vibe-ctl/extension-api';
import { LeftPanelHostWidget } from './widgets/LeftPanelHostWidget';
import { RightPanelHostWidget } from './widgets/RightPanelHostWidget';

/**
 * Side Panels plugin.
 *
 * Registers two host widgets that the shell mounts into the left/right
 * panel slots. The host widgets iterate over all other widgets whose
 * placements include the corresponding `side-panel:*` slot and render
 * them with tabs and resize.
 */
export default class SidePanelsPlugin extends Plugin {
  async onActivate(): Promise<void> {
    this.ctx.widgets.register({
      type: 'left-panel-host',
      component: LeftPanelHostWidget,
      ownedByPlugin: this.ctx.id,
      placements: ['custom:shell-left'],
      defaultSize: { width: 320, height: 0 },
    });

    this.ctx.widgets.register({
      type: 'right-panel-host',
      component: RightPanelHostWidget,
      ownedByPlugin: this.ctx.id,
      placements: ['custom:shell-right'],
      defaultSize: { width: 320, height: 0 },
    });
  }
}
