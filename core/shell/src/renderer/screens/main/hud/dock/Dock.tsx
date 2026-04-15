/**
 * Dock — Figma-toolbar / macOS-dock style pill anchored at the bottom
 * center of the HUD. Each item opens a full-screen overlay (agents
 * monitor, future: command palette, global search).
 *
 * State comes from `DockProvider` via `useDock()`. `OverlayHost` reads
 * the same provider to render the matching overlay.
 */

import type { FC } from 'react';
import { overlayRegistry } from '../../overlays/registry.js';
import { DockItem } from './DockItem.js';
import { useDock } from './useDock.js';

export const Dock: FC = () => {
  const { activeOverlayId, toggle } = useDock();
  return (
    <div
      className="no-drag -translate-x-1/2 absolute bottom-4 left-1/2 z-30 flex items-center gap-1 rounded-2xl bg-white/95 p-1.5 shadow-lg backdrop-blur-sm dark:bg-neutral-800/95"
      aria-label="Dock"
    >
      {overlayRegistry.map((entry) => (
        <DockItem
          key={entry.id}
          label={entry.label}
          active={activeOverlayId === entry.id}
          onClick={() => toggle(entry.id)}
        >
          {entry.icon}
        </DockItem>
      ))}
    </div>
  );
};
