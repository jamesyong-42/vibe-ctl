import type { KernelCanvasEngine } from '@vibe-ctl/canvas';
import type { CSSProperties, FC } from 'react';

export interface StatusBarSlotProps {
  engine: KernelCanvasEngine;
  side: 'left' | 'right';
}

const rootStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 6,
  height: 24,
  padding: '0 8px',
  fontSize: 11,
  borderTop: '1px solid rgba(127,127,127,0.2)',
};

/**
 * Status bar slot. Mounts widgets with placement `status-bar:left` or
 * `status-bar:right` (spec 01 §6).
 */
export const StatusBarSlot: FC<StatusBarSlotProps> = ({ side }) => {
  // TODO: Render all widget types whose placements include the
  //       matching `status-bar:{side}` value, in registration order.
  //       Widgets sized by their own `defaultSize`/`minSize` hints,
  //       clamped to the status-bar height (24px).
  return <div data-vibe-status-bar-slot data-side={side} style={rootStyle} />;
};
