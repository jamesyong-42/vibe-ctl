/**
 * Workspace layer — Layer 1 of the main screen.
 *
 * Mounts the infinite-canvas substrate at full-screen and wires the
 * global canvas keyboard shortcuts. Reads the engine from context
 * (every other screen layer is a consumer of the same context).
 *
 * Sibling HUD / dynamic-island / overlay layers render on top via
 * their own z-index; this component only fills the screen behind them.
 */

import { DEFAULT_GRID_CONFIG, type GridConfig, InfiniteCanvas } from '@jamesyong42/infinite-canvas';
import { type FC, useState } from 'react';
import { useEngine } from './useEngine.js';
import { useWorkspaceShortcuts } from './useWorkspaceShortcuts.js';

export const WorkspaceLayer: FC = () => {
  const engine = useEngine();
  const [gridConfig] = useState<GridConfig>({ ...DEFAULT_GRID_CONFIG });
  useWorkspaceShortcuts();

  return (
    <InfiniteCanvas
      engine={engine}
      grid={gridConfig}
      style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }}
    />
  );
};
