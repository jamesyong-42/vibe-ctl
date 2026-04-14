/**
 * Disposable contract used for anything that needs cleanup on plugin
 * deactivation. Compatible with the TC39 explicit-resource-management
 * proposal (`Symbol.dispose` / `Symbol.asyncDispose`).
 *
 * Any of the following shapes is accepted:
 *   - `{ dispose(): void | Promise<void> }`
 *   - `{ [Symbol.dispose](): void }`
 *   - `{ [Symbol.asyncDispose](): Promise<void> }`
 */
export interface Disposable {
  dispose?(): void | Promise<void>;
  [Symbol.dispose]?(): void;
  [Symbol.asyncDispose]?(): Promise<void>;
}
