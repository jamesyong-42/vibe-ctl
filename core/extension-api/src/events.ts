import type { WidgetPlacement } from './widgets.js';

/**
 * Kernel-owned event catalog. Plugins extend this via declaration merging
 * from their own npm package:
 *
 *   declare module '@vibe-ctl/extension-api' {
 *     interface VibeEvents {
 *       'claude-code.hook': HookEvent;
 *     }
 *   }
 */
export interface VibeEvents {
  'app.startup': { version: string };
  'app.shutdown': void;

  'plugin.activated': { pluginId: string };
  'plugin.deactivated': { pluginId: string };
  'plugin.error': { pluginId: string; error: Error };

  'service.available': { serviceId: string; providerId: string };
  'service.ready': { serviceId: string };
  'service.unavailable': { serviceId: string };

  'canvas.widget.added': { widgetId: string; type: string; placement: WidgetPlacement };
  'canvas.widget.removed': { widgetId: string };
  'canvas.viewport.changed': { x: number; y: number; zoom: number };

  'command.executed': { commandId: string; args: unknown[] };

  'settings.changed': { pluginId: string; key: string; value: unknown };
  'permission.granted': { pluginId: string; permission: string };
  'permission.revoked': { pluginId: string; permission: string };

  'mesh.peer.joined': { peerId: string; deviceName: string };
  'mesh.peer.left': { peerId: string };
  'mesh.status.changed': { connected: boolean; peerCount: number };
}
