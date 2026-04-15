/**
 * Back button + breadcrumb pill in the top-left drag strip.
 *
 * Positioned after the native traffic lights (which occupy ~70px on the
 * left edge) so the three controls stack horizontally: traffic lights →
 * back button → breadcrumb pill. Same visual idiom as Apple Freeform and
 * the infinite-canvas playground.
 *
 * The component subscribes to the engine's per-frame tick and rebuilds
 * crumbs only when the nav stack actually changed, matching the
 * playground's reactive pattern.
 */

import type { EntityId, LayoutEngine } from '@jamesyong42/infinite-canvas';
import { NavigationStackResource, WidgetData } from '@jamesyong42/infinite-canvas';
import { useEffect, useRef, useState } from 'react';

interface Crumb {
  depth: number;
  containerId: EntityId | null;
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

const backBtn: React.CSSProperties = {
  WebkitAppRegion: 'no-drag',
  width: 40,
  height: 40,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  border: 0,
  borderRadius: 9999,
  background: 'var(--button-bg, #fff)',
  color: 'var(--button-fg, #71717a)',
  boxShadow: '0 4px 12px rgba(0, 0, 0, 0.08)',
  cursor: 'pointer',
  transition: 'background-color 0.15s ease, color 0.15s ease, opacity 0.15s ease',
} as React.CSSProperties;

const pill: React.CSSProperties = {
  WebkitAppRegion: 'no-drag',
  display: 'flex',
  alignItems: 'center',
  gap: 2,
  padding: '6px 12px',
  borderRadius: 9999,
  background: 'var(--button-bg, #fff)',
  boxShadow: '0 4px 12px rgba(0, 0, 0, 0.08)',
  fontSize: 12,
  fontWeight: 500,
} as React.CSSProperties;

export function NavigationBreadcrumbs({ engine }: { engine: LayoutEngine }) {
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

  return (
    <div
      style={{
        position: 'absolute',
        // Starts after the native macOS traffic lights (left ~70px) with
        // a little breathing room. On non-mac the traffic lights are not
        // present, so the same offset reads as a comfortable inset.
        top: 16,
        left: 82,
        zIndex: 50,
        display: 'flex',
        alignItems: 'center',
        gap: 8,
      }}
    >
      <button
        type="button"
        onClick={goBack}
        disabled={!canGoBack}
        title={canGoBack ? 'Back (Esc)' : 'Already at root'}
        style={{
          ...backBtn,
          opacity: canGoBack ? 1 : 0.4,
          cursor: canGoBack ? 'pointer' : 'not-allowed',
        }}
      >
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
          <title>Back</title>
          <path d="m15 18-6-6 6-6" />
        </svg>
      </button>

      <nav aria-label="Navigation breadcrumbs" style={pill}>
        {crumbs.map((crumb, i) => {
          const isCurrent = i === crumbs.length - 1;
          return (
            <div
              key={`${crumb.depth}-${crumb.containerId ?? 'root'}`}
              style={{ display: 'flex', alignItems: 'center' }}
            >
              {i > 0 && (
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="12"
                  height="12"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  style={{ margin: '0 2px', color: '#a1a1aa' }}
                  aria-hidden="true"
                >
                  <title>Separator</title>
                  <path d="m9 18 6-6-6-6" />
                </svg>
              )}
              {isCurrent ? (
                <span
                  aria-current="page"
                  style={{
                    maxWidth: 160,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                    padding: '2px 6px',
                    color: 'var(--text, #18181b)',
                  }}
                >
                  {crumb.label}
                </span>
              ) : (
                <button
                  type="button"
                  onClick={() => jumpToDepth(crumb.depth)}
                  title={`Jump to ${crumb.label}`}
                  style={
                    {
                      WebkitAppRegion: 'no-drag',
                      border: 0,
                      background: 'transparent',
                      padding: '2px 6px',
                      maxWidth: 160,
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                      color: 'var(--button-fg, #71717a)',
                      borderRadius: 4,
                      cursor: 'pointer',
                      font: 'inherit',
                    } as React.CSSProperties
                  }
                >
                  {crumb.label}
                </button>
              )}
            </div>
          );
        })}
      </nav>
    </div>
  );
}
