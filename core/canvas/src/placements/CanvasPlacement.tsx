import type { FC } from 'react';
import type { KernelCanvasEngine } from '../engine.js';

export interface CanvasPlacementProps {
  engine: KernelCanvasEngine;
}

/**
 * Canvas placement slot. Mounts widgets of placement `'canvas'`.
 *
 * Unlike the other placements, the canvas slot is backed by the
 * infinite-canvas DOM host, so this component is responsible for
 * mounting the canvas root and delegating widget-instance rendering
 * to the library's own scene graph. Widget *type* availability is
 * queried from `engine.widgetTypes`; instance data comes from the
 * kernel ECS world the canvas-sync adapter populates from
 * `kernel/canvas-layout`.
 *
 * Widgets referencing a type not in `engine.widgetTypes` render as
 * `MissingPluginPlaceholder` (spec 02 §6.1).
 */
export const CanvasPlacement: FC<CanvasPlacementProps> = (_props) => {
  // TODO: Mount the infinite-canvas engine's DOM container (via ref),
  //       and subscribe to `engine.subscribeTypes` to re-render when
  //       new widget types come online. Widget *instances* are driven
  //       by the canvas ECS world; this component only owns the
  //       container + missing-plugin placeholder fallback path.
  return <div data-vibe-canvas-placement />;
};
