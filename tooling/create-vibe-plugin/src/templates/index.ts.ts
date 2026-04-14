import type { ScaffoldContext } from '../scaffold.js';

/**
 * Single-entry plugin skeleton. Used for `renderer` and `main` execution
 * contexts. Registers an example widget if one was requested.
 */
export function indexTsTemplate(ctx: ScaffoldContext): string {
  const importWidget = ctx.includeExampleWidget && ctx.executionContext !== 'main';
  const widgetImport = importWidget
    ? `\nimport { ExampleWidget } from './widgets/example-widget.js';\n`
    : '';

  const widgetRegistration = importWidget
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

  const body = importWidget
    ? widgetRegistration
    : `
    // TODO: register your contributions here
    //   this.ctx.commands.register({ ... });
    //   this.ctx.services.provide(...);
    this.ctx.logger.info('${ctx.displayName} activated');
`;

  return `import { Plugin } from '@vibe-ctl/extension-api';${widgetImport}

export default class ${classNameFor(ctx.pluginId)} extends Plugin {
  async onActivate() {${body}  }

  async onDeactivate() {
    // Disposables registered via ctx.track() are cleaned up automatically.
    // Only free resources the tracker can't see (native handles, child procs).
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
  return `${camel || 'MyPlugin'}Plugin`;
}
