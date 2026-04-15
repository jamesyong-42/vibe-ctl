/**
 * Overlay registry — the list of god-view overlays available to the
 * dock. Each entry is a lightweight descriptor (id, label, icon,
 * component). The dock renders one `DockItem` per entry; the
 * `OverlayHost` renders the entry whose id matches `useDock`'s active
 * overlay.
 *
 * Static today. Once plugins can contribute overlays, this becomes a
 * reactive registry driven by plugin activation.
 */

import type { FC } from 'react';
import { AgentsMonitorOverlay } from './agents-monitor/AgentsMonitorOverlay.js';

export interface OverlayDescriptor {
  id: string;
  label: string;
  /** Icon rendered in the dock. Plain React node (usually from @vibe-ctl/ui). */
  icon: React.ReactNode;
  component: FC;
}

export const overlayRegistry: OverlayDescriptor[] = [
  {
    id: 'agents-monitor',
    label: 'Agents Monitor',
    icon: <AgentsIcon />,
    component: AgentsMonitorOverlay,
  },
];

export function getOverlay(id: string | null): OverlayDescriptor | undefined {
  if (!id) return undefined;
  return overlayRegistry.find((entry) => entry.id === id);
}

// ── Local icon for the registry. Small enough not to deserve its own
// file until the registry grows past a couple entries. ──────────────
function AgentsIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <title>Agents</title>
      <path d="M3 3h7v7H3z" />
      <path d="M14 3h7v7h-7z" />
      <path d="M3 14h7v7H3z" />
      <path d="M14 14h7v7h-7z" />
    </svg>
  );
}
