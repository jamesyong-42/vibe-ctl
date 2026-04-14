import { Plugin } from '@vibe-ctl/plugin-api';
import { DeviceStatusWidget } from './widgets/DeviceStatusWidget';
import { PortProxyWidget } from './widgets/PortProxyWidget';

/**
 * Mesh Widgets plugin.
 *
 * Registers UI widgets for the kernel mesh surface. No services,
 * no sync data of its own — all state is read through `ctx.mesh`.
 */
export default class MeshWidgetsPlugin extends Plugin {
  async onActivate(): Promise<void> {
    this.ctx.widgets.register({
      type: 'device-status',
      component: DeviceStatusWidget,
      ownedByPlugin: this.ctx.id,
      placements: ['status-bar:right', 'side-panel:right'],
      defaultSize: { width: 220, height: 32 },
    });

    this.ctx.widgets.register({
      type: 'port-proxy',
      component: PortProxyWidget,
      ownedByPlugin: this.ctx.id,
      placements: ['side-panel:right', 'canvas'],
      defaultSize: { width: 320, height: 240 },
    });
  }
}
