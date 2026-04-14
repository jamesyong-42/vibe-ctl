import type { ScaffoldContext } from '../scaffold.js';

/**
 * Split-plugin main-half skeleton. Runs in a utilityProcess; exposes a
 * typed RPC surface the renderer half consumes via `ctx.rpc.connect()`.
 */
export function mainTsTemplate(ctx: ScaffoldContext): string {
  return `import { Plugin } from '@vibe-ctl/extension-api';

export interface MainApi {
  ping(): Promise<string>;
  // TODO: describe your main-half surface here. These methods are callable
  // from the renderer half via \`ctx.rpc!.connect<MainApi>()\`.
}

export default class ${classNameFor(ctx.pluginId)}Main extends Plugin {
  async onActivate() {
    this.ctx.rpc!.expose<MainApi>({
      ping: async () => 'pong',
      // TODO: implement your main-half methods
    });

    this.ctx.logger.info('${ctx.displayName} (main) activated');
  }

  async onDeactivate() {
    // Native handles, spawned processes, etc. should be disposed here.
  }
}
`;
}

function classNameFor(id: string): string {
  const tail = id.includes('/') ? id.split('/').pop()! : id;
  const camel = tail
    .replace(/^vibe-ctl-plugin-/, '')
    .replace(/^plugin-/, '')
    .split(/[-_]/)
    .filter(Boolean)
    .map((w) => w[0]!.toUpperCase() + w.slice(1))
    .join('');
  return camel || 'MyPlugin';
}
