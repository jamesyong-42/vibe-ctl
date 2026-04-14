import type { WidgetProps } from '@vibe-ctl/plugin-api';

/**
 * Widget: host for the right side panel.
 */
export function RightPanelHostWidget({ width, height }: WidgetProps) {
  return (
    <div style={{ width, height, padding: 8, borderLeft: '1px solid #333' }}>
      <h3>Right Panel</h3>
      <p>TODO: render side-panel:right widgets</p>
    </div>
  );
}
