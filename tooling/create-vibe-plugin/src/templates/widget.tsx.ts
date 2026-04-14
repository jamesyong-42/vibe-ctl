import type { ScaffoldContext } from '../scaffold.js';

/**
 * Example widget. Demonstrates the two main hooks a widget author uses:
 *   - useUI()           → host-provided primitive components
 *   - useWidgetConfig() → per-widget persisted state
 */
export function widgetTsxTemplate(ctx: ScaffoldContext): string {
  return `import { useUI, useWidgetConfig } from '@vibe-ctl/extension-api';

interface ExampleConfig {
  greeting: string;
}

const DEFAULT_CONFIG: ExampleConfig = { greeting: 'Hello from ${ctx.displayName}' };

export function ExampleWidget() {
  const ui = useUI();
  const [config, setConfig] = useWidgetConfig<ExampleConfig>();
  const greeting = config?.greeting ?? DEFAULT_CONFIG.greeting;

  return (
    <ui.Panel title="${ctx.displayName}">
      <ui.Input
        value={greeting}
        onChange={(v) => setConfig({ greeting: v })}
        placeholder="Greeting"
      />
      <ui.Separator />
      <ui.Badge>{greeting}</ui.Badge>
    </ui.Panel>
  );
}
`;
}
