import { useState } from 'react';

interface IslandItem {
  id: string;
  label: string;
}

/**
 * Dynamic-island state. Tracks pinned items (agent status, approval
 * requests, incoming notifications) that the notch widget surfaces.
 *
 * Placeholder — once the `notifications` + `claude-code` plugins land,
 * they push items through this hook (via context or IPC) and the
 * layer renders them.
 */
export function useDynamicIsland() {
  const [items] = useState<IslandItem[]>([]);
  return { items };
}
