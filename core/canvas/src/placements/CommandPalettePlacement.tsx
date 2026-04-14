import type { FC } from 'react';
import type { KernelCanvasEngine } from '../engine.js';

export interface CommandPalettePlacementProps {
  engine: KernelCanvasEngine;
}

/**
 * Command-palette placement slot. Mounts widgets with placement
 * `command-palette` — used for custom result rows (spec 01 §6).
 *
 * The kernel-owned command palette calls this component to render the
 * plugin-contributed result variations above the default fuzzy-match
 * rows.
 */
export const CommandPalettePlacement: FC<CommandPalettePlacementProps> = (_props) => {
  // TODO: Query `engine.widgetTypes.listByPlacement('command-palette')`
  //       and render one row per widget type. Each widget receives the
  //       current palette query as part of its config (runtime will
  //       pipe this through when mounting).
  return <div data-vibe-command-palette-placement />;
};
