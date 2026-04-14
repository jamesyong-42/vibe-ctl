import type { WidgetProps } from '@vibe-ctl/extension-api';

/**
 * Widget: Claude Code project list.
 *
 * TODO: use `useWidgetPlugin<ClaudeCodeRenderer>()` to fetch projects
 * and render them through `ctx.ui` primitives.
 */
export function ProjectListWidget({ width, height }: WidgetProps) {
  return (
    <div style={{ width, height, padding: 8 }}>
      <h3>Claude Code Projects</h3>
      <p>TODO: implement project list</p>
    </div>
  );
}
