/**
 * Main screen — the canvas experience.
 *
 * Three layers stacked by z-index, plus full-screen overlays that
 * cover them when the dock opens a god-view:
 *
 *   z:0    WorkspaceLayer       infinite canvas
 *   z:10   HudLayer             floating UI + dock
 *   z:30   DynamicIslandLayer   notch widget
 *   z:40   OverlayHost          agents-monitor etc (renders when active)
 *
 * Engine context is constructed once here (demo scene for now; the
 * runtime will hand in a pre-configured engine once the canvas-sync
 * adapter is wired up).
 */

import { type FC, useMemo } from 'react';
import { DynamicIslandLayer } from './dynamic-island/DynamicIslandLayer.js';
import { HudLayer } from './hud/HudLayer.js';
import { DockProvider } from './hud/dock/DockProvider.js';
import { OverlayHost } from './overlays/OverlayHost.js';
import { EngineProvider } from './workspace/EngineProvider.js';
import { WorkspaceLayer } from './workspace/WorkspaceLayer.js';
import { createDemoEngine } from './workspace/demoScene.js';

export const MainScreen: FC = () => {
  const engine = useMemo(() => createDemoEngine(), []);

  return (
    <EngineProvider engine={engine}>
      <DockProvider>
        <div className="relative h-screen w-screen overflow-hidden">
          <WorkspaceLayer />
          <HudLayer />
          <DynamicIslandLayer />
          <OverlayHost />
        </div>
      </DockProvider>
    </EngineProvider>
  );
};
