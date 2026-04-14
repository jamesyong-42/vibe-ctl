import type { ComponentType } from 'react';
import type { ZodType } from 'zod';
import type { Disposable } from './disposable.js';
import type { Breakpoint, Size } from './types.js';

/**
 * Where a widget can be placed. Built-in placements cover status bar,
 * side panels, canvas, command palette, and notification surface.
 * Plugins may declare a `custom:{id}` placement to contribute new slots,
 * though third-party slot registration is not supported in v1.
 */
export type WidgetPlacement =
  | 'canvas'
  | 'side-panel:left'
  | 'side-panel:right'
  | 'status-bar:left'
  | 'status-bar:right'
  | 'command-palette'
  | 'notification-surface'
  | `custom:${string}`;

/**
 * Props passed to every widget component. The runtime computes the
 * breakpoint from the current rendered size.
 */
export interface WidgetProps<Config = unknown> {
  config: Config;
  setConfig: (partial: Partial<Config>) => void;
  width: number;
  height: number;
  breakpoint: Breakpoint;
  placement: WidgetPlacement;
}

/**
 * A React-function-component for R3F widgets. Declared as a loose type
 * alias so plugin authors can use their own R3F component signature
 * without the extension-api pulling in three.js.
 */
// biome-ignore lint/suspicious/noExplicitAny: R3F components vary wildly; author decides props.
export type R3FComponent = ComponentType<any>;

/**
 * Definition passed to `ctx.widgets.register()`.
 */
export interface WidgetDef<Config = unknown> {
  /** Unique within the owning plugin. */
  type: string;
  /** React or R3F component. Matched by `renderer`. */
  component: ComponentType<WidgetProps<Config>> | R3FComponent;
  /** Which renderer the component targets. Default `react`. */
  renderer?: 'react' | 'r3f';
  /** The plugin ID that owns this widget. Determines direct-access rights. */
  ownedByPlugin: string;

  /** Where users can place it. */
  placements: WidgetPlacement[];
  defaultSize?: Size;
  minSize?: Size;

  /** Per-widget user config schema. */
  configSchema?: ZodType<Config>;
  defaultConfig?: Config;
}

/**
 * Surface exposed via `ctx.widgets`. The runtime backs this with the
 * kernel's WidgetType ECS registry.
 */
export interface WidgetRegistry {
  register<Config = unknown>(def: WidgetDef<Config>): Disposable;
}
