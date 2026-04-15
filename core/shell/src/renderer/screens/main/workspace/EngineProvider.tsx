/**
 * Canvas-engine context. The workspace owns the infinite-canvas
 * `LayoutEngine` instance; every HUD concept that needs the engine
 * (navigation crumbs, shortcuts, dock) consumes it via `useEngine()`.
 *
 * Kept inside `workspace/` because the engine's lifetime is scoped to
 * the main screen — other screens (loading, onboarding, version-gate)
 * do not need it.
 */

import type { LayoutEngine } from '@jamesyong42/infinite-canvas';
import { type ReactNode, createContext } from 'react';

export const EngineContext = createContext<LayoutEngine | null>(null);

export interface EngineProviderProps {
  engine: LayoutEngine;
  children: ReactNode;
}

export function EngineProvider({ engine, children }: EngineProviderProps): React.JSX.Element {
  return <EngineContext.Provider value={engine}>{children}</EngineContext.Provider>;
}
