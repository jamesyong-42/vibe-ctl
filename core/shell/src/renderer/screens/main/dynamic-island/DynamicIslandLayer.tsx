/**
 * Dynamic Island — Layer 3. macOS-only notch widget for quick
 * approvals and agent status. Renders a floating pill near the top
 * center; a native Swift helper handles the actual notch intrusion,
 * this React layer is the fallback DOM representation.
 *
 * Stub — no items until notifications/claude-code plugins contribute.
 */

import type { FC } from 'react';
import { useDynamicIsland } from './useDynamicIsland.js';

export const DynamicIslandLayer: FC = () => {
  const { items } = useDynamicIsland();
  if (items.length === 0) return null;

  return (
    <div
      aria-label="Dynamic Island"
      className="-translate-x-1/2 pointer-events-auto absolute top-2 left-1/2 z-30 flex items-center gap-2 rounded-full bg-black px-3 py-1.5 text-white text-xs shadow-lg"
    >
      {items.map((item) => (
        <span key={item.id}>{item.label}</span>
      ))}
    </div>
  );
};
