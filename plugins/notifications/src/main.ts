import { Plugin } from '@vibe-ctl/extension-api';

/**
 * Notifications main-half plugin.
 *
 * Owns the OS-notification bridge (Electron Notification API) and the
 * approval queue persistence. Renderer half drives UI and forwards user
 * decisions.
 */
export interface NotificationsMainApi {
  showOsNotification(opts: { title: string; body: string; id: string }): Promise<void>;
  closeOsNotification(id: string): Promise<void>;
  initializePromise: Promise<void>;
}

export default class NotificationsMain extends Plugin {
  async onActivate(): Promise<void> {
    const initializePromise = Promise.resolve();

    this.ctx.rpc?.expose<NotificationsMainApi>({
      showOsNotification: async (_opts) => {
        // TODO: new Notification(...) via Electron bridge
      },
      closeOsNotification: async (_id) => {
        // TODO: close handle
      },
      initializePromise,
    });
  }
}
