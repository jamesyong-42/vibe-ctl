import type { FC } from 'react';

/**
 * Agents Monitor overlay — placeholder. Future home of the full-screen
 * "god view" listing every running Claude Code session across every
 * device on the mesh, with live status + approval shortcuts.
 */
export const AgentsMonitorOverlay: FC = () => (
  <div className="flex h-full w-full items-center justify-center text-neutral-400 dark:text-neutral-500">
    <div className="text-center">
      <div className="mb-2 font-semibold text-2xl">Agents Monitor</div>
      <div className="text-sm">Full-screen god-view coming soon.</div>
    </div>
  </div>
);
