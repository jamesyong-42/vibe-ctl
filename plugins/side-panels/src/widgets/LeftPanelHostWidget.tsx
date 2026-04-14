import type { WidgetProps } from '@vibe-ctl/extension-api';

/**
 * Widget: host for the left side panel. Iterates over widgets placed
 * on `side-panel:left` and renders them with tabs + resize.
 */
export function LeftPanelHostWidget({ width, height }: WidgetProps) {
  return (
    <div style={{ width, height, padding: 8, borderRight: '1px solid #333' }}>
      <h3>Left Panel</h3>
      <p>TODO: render side-panel:left widgets</p>
    </div>
  );
}
