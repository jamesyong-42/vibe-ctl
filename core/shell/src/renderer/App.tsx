/**
 * Shell App — Freeform-inspired chrome around the infinite-canvas substrate.
 *
 * Layout:
 *   - Fullscreen <InfiniteCanvas> underneath everything
 *   - ~52px top strip with `-webkit-app-region: drag`, same bg as canvas,
 *     visually invisible. Native traffic lights sit at its left edge
 *     (positioned from main process via `trafficLightPosition`).
 *   - Floating round 40×40 buttons in three corners:
 *       top-right    → dark-mode toggle (top-left reserved for traffic lights)
 *       bottom-left  → settings
 *       bottom-right → inspector
 *   - <VersionGate> wraps everything so a blocking "update required" screen
 *     can supersede the shell per spec 02 §4.1.
 *
 * The canvas engine is owned directly by the shell for now. When the
 * canvas-sync adapter in `core/canvas` (spec 02 §4.2) is wired up, the
 * runtime will hand a pre-configured engine to the shell instead.
 */

import type { GridConfig } from '@jamesyong42/infinite-canvas';
import {
  Children,
  DEFAULT_GRID_CONFIG,
  InfiniteCanvas,
  createLayoutEngine,
} from '@jamesyong42/infinite-canvas';
import { useEffect, useMemo, useState } from 'react';
import { InventoryBanner } from './onboarding/InventoryBanner.js';
import { VersionGate } from './version-gate/VersionGate.js';
import { DebugCard } from './widgets/DebugCard.js';
import { DebugContainer, DebugContainerArchetype } from './widgets/DebugContainer.js';
import { DebugInteractive } from './widgets/DebugInteractive.js';

function createDemoScene() {
  const engine = createLayoutEngine({
    zoom: { min: 0.05, max: 8 },
    widgets: [DebugCard, DebugInteractive, DebugContainer],
    archetypes: [DebugContainerArchetype],
  });

  engine.spawn('debug-card', {
    at: { x: 80, y: 80 },
    data: {
      title: 'vibe-ctl',
      color: '#3b82f6',
      description: 'Infinite canvas dashboard. Pan with drag, zoom with scroll.',
    },
    zIndex: 1,
  });
  engine.spawn('debug-card', {
    at: { x: 380, y: 80 },
    size: { width: 220, height: 160 },
    data: {
      title: 'Agents',
      color: '#f59e0b',
      description: 'Claude Code sessions will live here.',
    },
    zIndex: 2,
  });
  engine.spawn('debug-interactive', {
    at: { x: 80, y: 300 },
    data: { title: 'Interactive' },
    zIndex: 3,
  });

  const container = engine.spawn('debug-container', {
    at: { x: 400, y: 300 },
    size: { width: 480, height: 320 },
    data: { title: 'Project: vibe-ctl' },
    zIndex: 4,
  });
  const child1 = engine.spawn('debug-card', {
    at: { x: 30, y: 30 },
    size: { width: 200, height: 130 },
    data: { title: 'Session A', color: '#8b5cf6' },
    zIndex: 1,
    parent: container,
  });
  const child2 = engine.spawn('debug-interactive', {
    at: { x: 250, y: 30 },
    size: { width: 200, height: 130 },
    data: { title: 'Session B' },
    zIndex: 2,
    parent: container,
  });
  engine.set(container, Children, { ids: [child1, child2] });

  return engine;
}

function FloatingButton({
  onClick,
  title,
  active,
  className,
  children,
}: {
  onClick: () => void;
  title: string;
  active?: boolean;
  className?: string;
  children: React.ReactNode;
}) {
  const activeCls = active
    ? 'bg-neutral-800 text-white dark:bg-white dark:text-neutral-800'
    : 'bg-white text-neutral-500 hover:bg-neutral-100 hover:text-neutral-700 dark:bg-neutral-800 dark:text-neutral-400 dark:hover:bg-neutral-700 dark:hover:text-neutral-200';
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      className={`no-drag z-50 flex h-10 w-10 items-center justify-center rounded-full shadow-lg transition-colors ${activeCls} ${className ?? ''}`}
    >
      {children}
    </button>
  );
}

export function App(): React.JSX.Element {
  const engine = useMemo(() => createDemoScene(), []);
  const [dark, setDark] = useState(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('vibe-dark-mode');
      if (saved !== null) return saved === 'true';
      return window.matchMedia('(prefers-color-scheme: dark)').matches;
    }
    return true;
  });
  const [showSettings, setShowSettings] = useState(false);
  const [showInspector, setShowInspector] = useState(false);
  const [gridConfig] = useState<GridConfig>({ ...DEFAULT_GRID_CONFIG });

  useEffect(() => {
    document.documentElement.classList.toggle('dark', dark);
    localStorage.setItem('vibe-dark-mode', String(dark));
    engine.markDirty();
  }, [dark, engine]);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const mod = e.metaKey || e.ctrlKey;
      if (mod && !e.shiftKey && e.key === 'z') {
        e.preventDefault();
        engine.undo();
        engine.markDirty();
      }
      if (mod && e.shiftKey && e.key === 'z') {
        e.preventDefault();
        engine.redo();
        engine.markDirty();
      }
      if (e.key === 'Escape' && engine.getNavigationDepth() > 0) {
        engine.exitContainer();
        engine.markDirty();
      }
      if (e.key === 'Backspace' || e.key === 'Delete') {
        const el = document.activeElement;
        if (el?.closest('input, textarea, select, [contenteditable]')) return;
        const selected = engine.getSelectedEntities();
        for (const id of selected) engine.destroyEntity(id);
        if (selected.length > 0) engine.markDirty();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [engine]);

  return (
    <VersionGate>
      <div className="relative h-screen w-screen overflow-hidden">
        <InfiniteCanvas engine={engine} grid={gridConfig} className="absolute inset-0" />

        {/* Invisible drag strip sharing canvas bg. Traffic lights overlay
            from the native window frame into its left edge. */}
        <div className="app-drag absolute top-0 left-0 right-0 h-[52px] z-40" />

        <FloatingButton
          onClick={() => setDark((d) => !d)}
          title={dark ? 'Switch to light mode' : 'Switch to dark mode'}
          className="absolute top-4 right-4"
        >
          {dark ? <SunIcon /> : <MoonIcon />}
        </FloatingButton>

        <FloatingButton
          onClick={() => setShowSettings((s) => !s)}
          title="Settings"
          active={showSettings}
          className="absolute bottom-4 left-4"
        >
          <SettingsIcon />
        </FloatingButton>

        <FloatingButton
          onClick={() => setShowInspector((s) => !s)}
          title="Inspector"
          active={showInspector}
          className="absolute bottom-4 right-4"
        >
          <InspectorIcon />
        </FloatingButton>

        <InventoryBanner />
      </div>
    </VersionGate>
  );
}

// ── Icons ────────────────────────────────────────────────────

const iconProps = {
  xmlns: 'http://www.w3.org/2000/svg',
  width: 18,
  height: 18,
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 2,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
};

function SunIcon() {
  return (
    <svg {...iconProps}>
      <title>Light mode</title>
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2" />
      <path d="M12 20v2" />
      <path d="m4.93 4.93 1.41 1.41" />
      <path d="m17.66 17.66 1.41 1.41" />
      <path d="M2 12h2" />
      <path d="M20 12h2" />
      <path d="m6.34 17.66-1.41 1.41" />
      <path d="m19.07 4.93-1.41 1.41" />
    </svg>
  );
}

function MoonIcon() {
  return (
    <svg {...iconProps}>
      <title>Dark mode</title>
      <path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z" />
    </svg>
  );
}

function SettingsIcon() {
  return (
    <svg {...iconProps}>
      <title>Settings</title>
      <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

function InspectorIcon() {
  return (
    <svg {...iconProps}>
      <title>Inspector</title>
      <path d="M12 20h9" />
      <path d="M16.376 3.622a1 1 0 0 1 3.002 3.002L7.368 18.635a2 2 0 0 1-.855.506l-2.872.838a.5.5 0 0 1-.62-.62l.838-2.872a2 2 0 0 1 .506-.854z" />
    </svg>
  );
}
