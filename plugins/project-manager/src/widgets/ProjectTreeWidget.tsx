import type { WidgetProps } from '@vibe-ctl/extension-api';

/**
 * Widget: project tree. Renders the hierarchical project / session
 * view.
 */
export function ProjectTreeWidget({ width, height }: WidgetProps) {
  return (
    <div style={{ width, height, padding: 8 }}>
      <h3>Projects</h3>
      <p>TODO: render project tree</p>
    </div>
  );
}
