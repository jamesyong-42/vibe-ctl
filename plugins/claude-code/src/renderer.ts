import { Plugin } from '@vibe-ctl/extension-api';
import type { ClaudeCodeMainApi } from './main';
import { ProjectListWidget } from './widgets/ProjectListWidget';

/**
 * Claude Code renderer-half plugin.
 *
 * Connects to the main-half over `ctx.rpc`, provides the `claude-code`
 * service (façade with permission checks), registers widgets, and
 * publishes a per-device session index via `ctx.sync`.
 */
export default class ClaudeCodeRenderer extends Plugin {
  async onActivate(): Promise<void> {
    const main = this.ctx.rpc?.connect<ClaudeCodeMainApi>();
    if (!main) {
      throw new Error('claude-code renderer requires ctx.rpc');
    }

    // TODO: publish session-index via ctx.sync.syncedStore('session-index')
    // TODO: provide the 'claude-code' service with warmup:
    //   this.ctx.services.provide('claude-code', facade, {
    //     warmup: main.initializePromise,
    //   });

    this.ctx.widgets.register({
      type: 'project-list',
      component: ProjectListWidget,
      ownedByPlugin: this.ctx.id,
      placements: ['canvas', 'side-panel:left'],
      defaultSize: { width: 320, height: 480 },
    });
  }
}
