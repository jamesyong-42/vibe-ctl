import { Plugin } from '@vibe-ctl/plugin-api';

/**
 * Terminal main-half plugin.
 *
 * Owns the Avocado SDK PTY host. Exposes spawn/resize/write/kill over
 * RPC, forwards PTY data to the renderer half, and listens for mesh
 * requests from other devices that want to stream a session.
 */
export interface TerminalMainApi {
  spawn(opts: { cols: number; rows: number; cwd?: string; shell?: string }): Promise<string>;
  write(sessionId: string, data: string): Promise<void>;
  resize(sessionId: string, cols: number, rows: number): Promise<void>;
  kill(sessionId: string): Promise<void>;
  listSessions(): Promise<string[]>;
  initializePromise: Promise<void>;
}

export default class TerminalMain extends Plugin {
  async onActivate(): Promise<void> {
    // TODO: import and start Avocado PTY host from '@vibecook/avocado-sdk'
    // TODO: subscribe to mesh 'pty-stream-request' messages

    const initializePromise = Promise.resolve();

    this.ctx.rpc?.expose<TerminalMainApi>({
      spawn: async (_opts) => {
        // TODO: return avocado.spawn(opts).id
        return 'stub-session-id';
      },
      write: async (_sessionId, _data) => {
        // TODO: avocado.write(sessionId, data)
      },
      resize: async (_sessionId, _cols, _rows) => {
        // TODO: avocado.resize(sessionId, cols, rows)
      },
      kill: async (_sessionId) => {
        // TODO: avocado.kill(sessionId)
      },
      listSessions: async () => {
        // TODO: return avocado.list()
        return [];
      },
      initializePromise,
    });
  }
}
