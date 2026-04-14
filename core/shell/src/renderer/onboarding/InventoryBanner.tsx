/**
 * First-run plugin-inventory diff banner.
 *
 * Spec 02 §9: when a device joins the mesh and sees that peers have
 * plugins it doesn't have installed, we show a non-blocking banner
 * offering to install them. Default: "match plugins across devices" is
 * OFF; the banner is the opt-in.
 *
 * Stub: renders nothing for now; wires up once the inventory query API
 * is exposed through the preload surface.
 */

import { useState } from 'react';

interface MissingPlugin {
  id: string;
  name: string;
  version: string;
}

export function InventoryBanner(): React.JSX.Element | null {
  // TODO: subscribe to `window.__vibeCtl.runtime.inventoryDiff` once wired.
  const [missing] = useState<MissingPlugin[]>([]);

  if (missing.length === 0) return null;

  return (
    <div
      role="status"
      style={{
        position: 'fixed',
        top: 12,
        right: 12,
        padding: '10px 14px',
        borderRadius: 8,
        background: 'rgba(40,40,48,0.95)',
        color: '#e7e7ea',
        fontSize: 13,
        display: 'flex',
        gap: 12,
        alignItems: 'center',
        boxShadow: '0 4px 16px rgba(0,0,0,0.35)',
        zIndex: 1000,
      }}
    >
      <span>
        {missing.length} plugin{missing.length === 1 ? '' : 's'} available on peers.
      </span>
      <button type="button">Review</button>
    </div>
  );
}
