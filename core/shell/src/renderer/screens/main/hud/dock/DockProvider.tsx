import { type ReactNode, createContext, useMemo, useState } from 'react';

export interface DockState {
  activeOverlayId: string | null;
  open: (id: string) => void;
  close: () => void;
  toggle: (id: string) => void;
}

export const DockContext = createContext<DockState | null>(null);

/**
 * Shared dock state provider. Both the Dock (item highlight) and the
 * OverlayHost (render the matching overlay) consume this. Mounted by
 * `MainScreen` so its scope is the main screen only.
 */
export function DockProvider({ children }: { children: ReactNode }): React.JSX.Element {
  const [activeOverlayId, setActiveOverlayId] = useState<string | null>(null);
  const value = useMemo<DockState>(
    () => ({
      activeOverlayId,
      open: (id) => setActiveOverlayId(id),
      close: () => setActiveOverlayId(null),
      toggle: (id) => setActiveOverlayId((current) => (current === id ? null : id)),
    }),
    [activeOverlayId],
  );
  return <DockContext.Provider value={value}>{children}</DockContext.Provider>;
}
