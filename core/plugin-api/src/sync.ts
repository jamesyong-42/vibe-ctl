/**
 * Sync API exposed on `ctx.sync`. Plugins access CRDT docs and
 * SyncedStores by the names they declared in `manifest.sync.data[]`.
 *
 * The underlying `CrdtDoc` and `SyncedStore` types come from
 * `@vibecook/truffle`, which is an optional peer dependency. Importing
 * from truffle at plugin-author time gives real Loro types; in this
 * package we re-export them through a light conditional type so the
 * plugin-api stays usable when truffle isn't installed.
 */

// biome-ignore lint/suspicious/noExplicitAny: truffle is optional; degrade to `any` when absent.
type TruffleCrdtDoc = any;
// biome-ignore lint/suspicious/noExplicitAny: truffle is optional; degrade to `any` when absent.
type TruffleSyncedStore<_T> = any;

/**
 * A Loro-backed CRDT document. Concurrent edits merge. The concrete
 * shape comes from `@vibecook/truffle`; this alias is a type alias to
 * the real truffle export when the package is available.
 */
export type CrdtDoc = TruffleCrdtDoc;

/**
 * A SyncedStore where each device owns one slice and reads others' via
 * `.all()`. The concrete shape comes from `@vibecook/truffle`.
 */
export type SyncedStore<T> = TruffleSyncedStore<T>;

/**
 * Surface exposed via `ctx.sync`. Declared doc names are strict:
 * calling a method with a name that isn't in `manifest.sync.data[]`
 * throws. See spec 01 §8.
 */
export interface SyncAPI {
  /**
   * Access a CRDT document declared in `manifest.sync.data[]` with
   * `type: 'crdt'`. Auto-namespaced to `plugin:{pluginId}:{name}`.
   */
  crdtDoc(name: string): CrdtDoc;

  /**
   * Access a SyncedStore declared in `manifest.sync.data[]` with
   * `type: 'store'`. Auto-namespaced to `plugin:{pluginId}:{name}`.
   */
  syncedStore<T>(name: string): SyncedStore<T>;
}
