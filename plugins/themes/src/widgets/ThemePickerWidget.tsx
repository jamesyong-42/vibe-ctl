import type { WidgetProps } from '@vibe-ctl/extension-api';

/**
 * Widget: theme picker. Lists registered themes and lets the user
 * switch between them.
 */
export function ThemePickerWidget({ width, height }: WidgetProps) {
  return (
    <div style={{ width, height, padding: 8 }}>
      <h3>Theme</h3>
      <p>TODO: render registered themes</p>
    </div>
  );
}
