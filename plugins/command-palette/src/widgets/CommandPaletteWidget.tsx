import type { WidgetProps } from '@vibe-ctl/plugin-api';

/**
 * Widget: the command palette itself. Rendered on the dedicated
 * `command-palette` placement when the palette is opened.
 */
export function CommandPaletteWidget({ width, height }: WidgetProps) {
  return (
    <div style={{ width, height, padding: 8 }}>
      <h3>Command Palette</h3>
      <p>TODO: fuzzy-search over ctx.commands</p>
    </div>
  );
}
