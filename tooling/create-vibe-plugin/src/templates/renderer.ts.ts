import type { ScaffoldContext } from '../scaffold.js';

/**
 * Split-plugin renderer-half skeleton. Runs in the renderer process.
 * Connects to the main half via `ctx.rpc.connect<MainApi>()`, and is the
 * recommended place to publish services + widgets.
 */
export function rendererTsTemplate(ctx: ScaffoldContext): string {
  const importWidget = ctx.includeExampleWidget
    ? `\nimport { ExampleWidget } from './widgets/example-widget.js';\n`
    : '';

  const widgetRegistration = ctx.includeExampleWidget
    ? `
    this.ctx.widgets.register({
      type: 'example',
      component: ExampleWidget,
      ownedByPlugin: this.ctx.id,
      placements: ['canvas', 'side-panel:right'],
      defaultSize: { width: 320, height: 240 },
    });
`
    : '';

  return `import { Plugin } from '@vibe-ctl/extension-api';${importWidget}
import type { MainApi } from './main.js';

export default class ${classNameFor(ctx.pluginId)}Renderer extends Plugin {
  private main!: MainApi;

  async onActivate() {
    this.main = this.ctx.rpc!.connect<MainApi>();
${widgetRegistration}
    // TODO: expose a service to other plugins
    //   this.ctx.services.provide('my-service', impl, { warmup: ... });

    this.ctx.logger.info('${ctx.displayName} (renderer) activated');
  }

  async onDeactivate() {
    // Disposables registered via ctx.track() are cleaned up automatically.
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
