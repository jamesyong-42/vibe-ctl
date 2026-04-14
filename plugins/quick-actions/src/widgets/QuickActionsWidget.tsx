import type { WidgetProps } from '@vibe-ctl/extension-api';

/**
 * Widget: quick actions grid. Renders a grid of pinnable shortcuts
 * that call into other plugins' services (claude-code, terminal).
 */
export function QuickActionsWidget({ width, height }: WidgetProps) {
  return (
    <div style={{ width, height, padding: 8 }}>
      <h3>Quick Actions</h3>
      <p>TODO: render pinnable action tiles</p>
    </div>
  );
}
