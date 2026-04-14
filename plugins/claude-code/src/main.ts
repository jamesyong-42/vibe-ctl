import { Plugin } from '@vibe-ctl/plugin-api';

/**
 * Claude Code main-half plugin.
 *
 * Runs in the utility process. Owns the Spaghetti SDK handle, watches
 * hook events, and exposes a typed RPC surface consumed by the renderer
 * half (see ./renderer.ts).
 */
export interface ClaudeCodeMainApi {
  listProjects(): Promise<unknown[]>;
  getSessions(projectSlug: string): Promise<unknown[]>;
  readTranscript(sessionId: string): Promise<unknown[]>;
  approve(sessionId: string, requestId: string): Promise<void>;
  initializePromise: Promise<void>;
}

export default class ClaudeCodeMain extends Plugin {
  async onActivate(): Promise<void> {
    // TODO: const api = createSpaghettiService();
    // TODO: const watcher = createHookEventWatcher();
    // TODO: this.ctx.track(watcher);
    // TODO: await watcher.start();
    // TODO: watcher.onEvent(e => this.ctx.emit('claude-code.hook', e));

    const initializePromise = Promise.resolve();

    this.ctx.rpc?.expose<ClaudeCodeMainApi>({
      listProjects: async () => {
        // TODO: return api.getProjectList();
        return [];
      },
      getSessions: async (_projectSlug: string) => {
        // TODO: return api.getSessionList(projectSlug);
        return [];
      },
      readTranscript: async (_sessionId: string) => {
        // TODO: return api.getSessionMessages(sessionId);
        return [];
      },
      approve: async (_sessionId: string, _requestId: string) => {
        // TODO: wire to Spaghetti approval API
      },
      initializePromise,
    });
  }
}
