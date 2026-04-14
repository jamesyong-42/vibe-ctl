import { Plugin } from '@vibe-ctl/plugin-api';

/**
 * Dynamic Island main-half plugin.
 *
 * Spawns and owns the Swift NotchHelper child process. Exposes helper
 * control + a live event stream over RPC to the renderer half.
 */
export interface DynamicIslandMainApi {
  setState(payload: { kind: 'idle' | 'busy' | 'approval'; label?: string }): Promise<void>;
  ping(): Promise<boolean>;
  initializePromise: Promise<void>;
}

export default class DynamicIslandMain extends Plugin {
  async onActivate(): Promise<void> {
    // TODO: spawn NotchHelper binary via child_process
    // TODO: wire its stdout/stdin as an IPC channel

    const initializePromise = Promise.resolve();

    this.ctx.rpc?.expose<DynamicIslandMainApi>({
      setState: async (_payload) => {
        // TODO: forward to NotchHelper
      },
      ping: async () => false,
      initializePromise,
    });
  }

  override async onDeactivate(): Promise<void> {
    // TODO: terminate NotchHelper child process
  }
}
