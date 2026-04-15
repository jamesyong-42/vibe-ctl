import type { LayoutEngine } from '@jamesyong42/infinite-canvas';
import { useContext } from 'react';
import { EngineContext } from './EngineProvider.js';

/**
 * Hook access to the canvas engine. Must be called inside the
 * workspace subtree where `<EngineProvider/>` is mounted; throws
 * otherwise so callers surface missing-provider bugs immediately.
 */
export function useEngine(): LayoutEngine {
  const engine = useContext(EngineContext);
  if (!engine) {
    throw new Error(
      'useEngine() called outside <EngineProvider/>. Mount EngineProvider before any HUD consumer.',
    );
  }
  return engine;
}
