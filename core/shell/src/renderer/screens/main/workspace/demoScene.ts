/**
 * Temporary demo scene for the workspace.
 *
 * TODO(plugin-host): remove once the plugin system can contribute
 * widgets. Debug widgets should ship as `plugins/debug-widgets/`, not
 * live in the shell. This file is scaffolding that lets the canvas
 * render something visible while the plugin host is being wired up.
 */

import { Children, type LayoutEngine, createLayoutEngine } from '@jamesyong42/infinite-canvas';
import { DebugCard } from './widgets/DebugCard.js';
import { DebugContainer, DebugContainerArchetype } from './widgets/DebugContainer.js';
import { DebugInteractive } from './widgets/DebugInteractive.js';

export function createDemoEngine(): LayoutEngine {
  const engine = createLayoutEngine({
    zoom: { min: 0.05, max: 8 },
    widgets: [DebugCard, DebugInteractive, DebugContainer],
    archetypes: [DebugContainerArchetype],
  });
  seedDemoScene(engine);
  return engine;
}

function seedDemoScene(engine: LayoutEngine): void {
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
}
