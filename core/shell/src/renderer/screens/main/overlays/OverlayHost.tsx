/**
 * Full-screen overlay host. Reads the active overlay id from the dock
 * context and renders the matching overlay from the registry on top
 * of the main screen (z-index above HUD + dynamic-island).
 *
 * Click-outside / Escape to close is delegated to this host so every
 * overlay gets consistent dismissal without re-implementing it.
 */

import type { FC } from 'react';
import { useEffect } from 'react';
import { useDock } from '../hud/dock/useDock.js';
import { getOverlay } from './registry.js';

export const OverlayHost: FC = () => {
  const { activeOverlayId, close } = useDock();
  const overlay = getOverlay(activeOverlayId);

  useEffect(() => {
    if (!overlay) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [overlay, close]);

  if (!overlay) return null;
  const Component = overlay.component;

  return (
    <div
      role="dialog"
      aria-label={overlay.label}
      aria-modal="true"
      className="absolute inset-0 z-40 bg-white/95 backdrop-blur-sm dark:bg-neutral-900/95"
    >
      <Component />
    </div>
  );
};
