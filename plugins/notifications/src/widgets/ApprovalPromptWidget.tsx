import type { WidgetProps } from '@vibe-ctl/extension-api';

/**
 * Widget: approval prompt. Renders a pending permission / tool-use
 * request and exposes approve / deny actions.
 */
export function ApprovalPromptWidget({ width, height }: WidgetProps) {
  return (
    <div style={{ width, height, padding: 8 }}>
      <h3>Approval Request</h3>
      <p>TODO: render pending approvals</p>
    </div>
  );
}
