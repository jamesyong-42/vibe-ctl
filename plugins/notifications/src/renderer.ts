import { Plugin } from '@vibe-ctl/plugin-api';
import type { NotificationsMainApi } from './main';
import { ApprovalPromptWidget } from './widgets/ApprovalPromptWidget';

/**
 * Notifications renderer-half plugin.
 *
 * Provides the `notifications` service, registers the approval-prompt
 * widget on the notification surface, and subscribes to Claude Code hook
 * events to surface approval requests.
 */
export default class NotificationsRenderer extends Plugin {
  async onActivate(): Promise<void> {
    const main = this.ctx.rpc?.connect<NotificationsMainApi>();
    if (!main) {
      throw new Error('notifications renderer requires ctx.rpc');
    }

    // TODO: this.ctx.services.provide('notifications', facade, {
    //   warmup: main.initializePromise,
    // });
    //
    // TODO: const cc = this.ctx.services.optional('claude-code');
    // TODO: cc?.onHookEvent(event => this.queueApproval(event));

    this.ctx.widgets.register({
      type: 'approval-prompt',
      component: ApprovalPromptWidget,
      ownedByPlugin: this.ctx.id,
      placements: ['notification-surface', 'side-panel:right'],
      defaultSize: { width: 360, height: 240 },
    });
  }
}
