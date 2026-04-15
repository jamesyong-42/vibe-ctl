import type { KernelCanvasEngine } from '@vibe-ctl/canvas';
import type { CSSProperties, FC } from 'react';

export interface NotificationSurfaceSlotProps {
  engine: KernelCanvasEngine;
}

const rootStyle: CSSProperties = {
  position: 'fixed',
  top: 12,
  right: 12,
  display: 'flex',
  flexDirection: 'column',
  gap: 6,
  zIndex: 900,
  pointerEvents: 'none',
};

/**
 * Notification-surface slot. Mounts widgets with placement
 * `notification-surface`. Typically used by a notification plugin to
 * stack toasts; the plugin owns the notification data model and each
 * toast is a widget instance.
 */
export const NotificationSurfaceSlot: FC<NotificationSurfaceSlotProps> = (_props) => {
  // TODO: Render one widget per active notification. The notifications
  //       plugin maintains the list in its own SyncedStore (or local
  //       state) and spawns/removes widget instances through
  //       `ctx.canvas.addWidget(...)`.
  return <div data-vibe-notification-surface-slot style={rootStyle} />;
};
