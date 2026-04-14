import { Plugin } from '@vibe-ctl/extension-api';
import type { TerminalMainApi } from './main';
import { TerminalWidget } from './widgets/TerminalWidget';

/**
 * Terminal renderer-half plugin.
 *
 * Provides the `terminal` service (façade with permission checks for
 * `terminal:spawn`), registers the terminal widget, and mirrors session
 * metadata into `ctx.sync.syncedStore('sessions')` for cross-device
 * discovery.
 */
export default class TerminalRenderer extends Plugin {
  async onActivate(): Promise<void> {
    const main = this.ctx.rpc?.connect<TerminalMainApi>();
    if (!main) {
      throw new Error('terminal renderer requires ctx.rpc');
    }

    // TODO: this.ctx.sync.syncedStore('sessions') — publish local metadata
    // TODO: this.ctx.services.provide('terminal', facade, { warmup: main.initializePromise })
    // TODO: ctx.mesh.subscribe('pty-stream') for remote viewer support

    this.ctx.widgets.register({
      type: 'terminal',
      component: TerminalWidget,
      ownedByPlugin: this.ctx.id,
      placements: ['canvas', 'side-panel:right'],
      defaultSize: { width: 640, height: 400 },
    });
  }
}
