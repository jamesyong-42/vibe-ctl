/**
 * Shared primitive types used across the extension API.
 */

/** Plugin trust tier. Source-determined by the kernel, never read from manifest. */
export type PluginTier = 'T1' | 'T2' | 'T3';

/** 2D point used for widget positions and canvas coordinates. */
export interface Point {
  x: number;
  y: number;
}

/** 2D size used for widget dimensions. */
export interface Size {
  width: number;
  height: number;
}

/**
 * Widget responsive breakpoint. The canvas engine classifies widgets
 * by their current rendered size so authors can adapt their UI.
 */
export type Breakpoint = 'micro' | 'compact' | 'normal' | 'expanded' | 'detailed';

/**
 * Scoped logger handed to each plugin via `ctx.logger`. Output is routed
 * to the plugin dev panel. Levels map to standard syslog severities.
 */
export interface Logger {
  trace(message: string, meta?: Record<string, unknown>): void;
  debug(message: string, meta?: Record<string, unknown>): void;
  info(message: string, meta?: Record<string, unknown>): void;
  warn(message: string, meta?: Record<string, unknown>): void;
  error(message: string, meta?: Record<string, unknown>): void;
}
