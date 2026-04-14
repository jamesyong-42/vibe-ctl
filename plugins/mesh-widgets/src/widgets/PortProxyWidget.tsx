import type { WidgetProps } from '@vibe-ctl/plugin-api';

/**
 * Widget: port proxy controls. Lets the user expose a local port via
 * `ctx.mesh.proxyPort()` (requires the `mesh:proxy` permission).
 */
export function PortProxyWidget({ width, height }: WidgetProps) {
  return (
    <div style={{ width, height, padding: 8 }}>
      <h3>Port Proxy</h3>
      <p>TODO: forms for listen/target ports</p>
    </div>
  );
}
