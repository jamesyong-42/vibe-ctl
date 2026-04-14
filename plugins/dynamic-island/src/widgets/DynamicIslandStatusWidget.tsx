import type { WidgetProps } from '@vibe-ctl/plugin-api';

/**
 * Widget: dynamic island status (diagnostic mirror of the NotchHelper
 * state). Shown in the main window status bar so users can confirm the
 * native helper is alive.
 */
export function DynamicIslandStatusWidget({ width, height }: WidgetProps) {
  return (
    <div style={{ width, height, padding: 4, fontSize: 12 }}>
      <span>Island: TODO</span>
    </div>
  );
}
