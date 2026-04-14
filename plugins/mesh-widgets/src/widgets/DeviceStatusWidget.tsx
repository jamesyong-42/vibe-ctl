import type { WidgetProps } from '@vibe-ctl/plugin-api';

/**
 * Widget: device status. Shows online peers pulled from `ctx.mesh.peers()`.
 */
export function DeviceStatusWidget({ width, height }: WidgetProps) {
  return (
    <div style={{ width, height, padding: 4, fontSize: 12 }}>
      <span>Mesh: TODO</span>
    </div>
  );
}
