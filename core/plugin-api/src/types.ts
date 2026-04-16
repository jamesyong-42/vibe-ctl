/**
 * Shared primitive types used across the plugin API.
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
 *
 * Signature matches pino's overloaded API: `log.info('msg')` or
 * `log.info({ key: val }, 'msg')`.
 */
export interface Logger {
  trace(msg: string): void;
  trace(obj: object, msg: string): void;
  debug(msg: string): void;
  debug(obj: object, msg: string): void;
  info(msg: string): void;
  info(obj: object, msg: string): void;
  warn(msg: string): void;
  warn(obj: object, msg: string): void;
  error(msg: string): void;
  error(obj: object, msg: string): void;
}
