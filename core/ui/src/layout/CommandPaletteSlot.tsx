import type { KernelCanvasEngine } from '@vibe-ctl/canvas';
import type { FC } from 'react';

export interface CommandPaletteSlotProps {
  engine: KernelCanvasEngine;
}

/**
 * Command-palette slot. Mounts widgets with placement `command-palette`
 * — used for custom result rows (spec 01 §6).
 *
 * The kernel-owned command palette calls this component to render the
 * plugin-contributed result variations above the default fuzzy-match
 * rows.
 */
export const CommandPaletteSlot: FC<CommandPaletteSlotProps> = (_props) => {
  // TODO: Query `engine.widgetTypes.listByPlacement('command-palette')`
  //       and render one row per widget type. Each widget receives the
  //       current palette query as part of its config (runtime will
  //       pipe this through when mounting).
  return <div data-vibe-command-palette-slot />;
};
