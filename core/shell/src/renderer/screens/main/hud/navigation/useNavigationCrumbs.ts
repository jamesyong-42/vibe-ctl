import {
  type EntityId,
  type LayoutEngine,
  NavigationStackResource,
  WidgetData,
} from '@jamesyong42/infinite-canvas';
import { useEffect, useRef, useState } from 'react';
import { useEngine } from '../../workspace/useEngine.js';

export interface Crumb {
  /** Depth index in the navigation stack. 0 = root. */
  depth: number;
  /** Container entity ID for this frame, or null at root. */
  containerId: EntityId | null;
  /** Human-readable label (container title, entity id fallback, or "Root"). */
  label: string;
}

function readCrumbs(engine: LayoutEngine): Crumb[] {
  const frames = engine.world.getResource(NavigationStackResource).frames;
  return frames.map((frame, depth) => {
    if (frame.containerId === null) {
      return { depth, containerId: null, label: 'Root' };
    }
    const data = engine.get(frame.containerId, WidgetData);
    const title = (data?.data as { title?: unknown } | undefined)?.title;
    return {
      depth,
      containerId: frame.containerId,
      label: typeof title === 'string' && title.length > 0 ? title : `#${frame.containerId}`,
    };
  });
}

function crumbsEqual(a: Crumb[], b: Crumb[]): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    const ac = a[i];
    const bc = b[i];
    if (!ac || !bc) return false;
    if (ac.containerId !== bc.containerId || ac.label !== bc.label) return false;
  }
  return true;
}

/**
 * Subscribes to the engine's per-frame tick and returns the current
 * navigation crumb trail plus imperative navigation helpers.
 *
 * Re-renders only when the stack actually changes (structural compare).
 */
export function useNavigationCrumbs() {
  const engine = useEngine();
  const [crumbs, setCrumbs] = useState<Crumb[]>(() => readCrumbs(engine));
  const lastCrumbsRef = useRef<Crumb[]>(crumbs);

  useEffect(() => {
    const unsubscribe = engine.onFrame(() => {
      const next = readCrumbs(engine);
      if (!crumbsEqual(lastCrumbsRef.current, next)) {
        lastCrumbsRef.current = next;
        setCrumbs(next);
      }
    });
    return unsubscribe;
  }, [engine]);

  const canGoBack = crumbs.length > 1;

  const goBack = () => {
    if (!canGoBack) return;
    engine.exitContainer();
    engine.markDirty();
  };

  const jumpToDepth = (targetDepth: number) => {
    const currentDepth = crumbs.length - 1;
    if (targetDepth >= currentDepth) return;
    const steps = currentDepth - targetDepth;
    for (let i = 0; i < steps; i++) engine.exitContainer();
    engine.markDirty();
  };

  return { crumbs, canGoBack, goBack, jumpToDepth };
}
