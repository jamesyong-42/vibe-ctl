import type { CSSProperties, FC } from 'react';
import type { KernelCanvasEngine } from '../engine.js';

export interface SidePanelPlacementProps {
  engine: KernelCanvasEngine;
  side: 'left' | 'right';
}

const rootStyle: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 4,
  height: '100%',
  padding: 8,
  borderRight: '1px solid rgba(127,127,127,0.2)',
  boxSizing: 'border-box',
  minWidth: 240,
};

/**
 * Side-panel placement slot. Mounts widgets with placement
 * `side-panel:left` or `side-panel:right`.
 *
 * Reads from `engine.widgetTypes.listByPlacement(...)` and renders one
 * container per widget type. Per-instance config comes from the
 * kernel world; this slot is stateless and only maps type → component.
 */
export const SidePanelPlacement: FC<SidePanelPlacementProps> = ({ side: _side }) => {
  // TODO: Subscribe to `engine.subscribeTypes` so the panel re-renders
  //       when plugins (un)register widget types. Resolve instances by
  //       scanning `kernel/canvas-layout` for entries whose placement
  //       matches. Render `MissingPluginPlaceholder` for orphans.
  return <div data-vibe-side-panel-placement style={rootStyle} />;
};
