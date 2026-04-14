# 01 -- Extension System: Manifest & Plugin Class

> The concrete contracts for plugin authors. Once published, these cannot
> change without a major version bump.

**Depends on:** `00-overview.md`
**Audience:** Kernel implementors + plugin authors
**Status:** Draft v3 (aligned with kernel-owned mesh/sync from spec 02)

---

## 1. Design Rules

1. **Programmatic over declarative.** Everything registered via `ctx` calls
   in `onActivate`, not JSON contribution arrays.
2. **Types are the contract.** Service interfaces live in TypeScript.
   Plugins import types from each other. No separate JSON schemas.
3. **Execution context is explicit.** Every plugin declares where it runs:
   renderer, main, or split.
4. **Warmup is first-class.** Heavy plugins register services immediately
   with a `warmup` promise; consumers can await readiness.
5. **Widget is the universal UI primitive.** Status items, side panels, and
   canvas items are all widgets with different placements.
6. **Direct binding for own widgets; façade for others.** A widget owned by
   plugin X has direct access to X's internals. Widgets consuming other
   plugins' services go through the service façade (with permission checks).
7. **Permissions are plain strings.** Declared in manifest, enforced
   via `ctx.permissions.require()` at call sites.
8. **Sync is declared, never ambient.** Every synced doc a plugin touches is
   listed in the manifest's `sync.data[]`. `ctx.sync` only grants access
   to what was declared.

---

## 2. `plugin.json` Manifest Schema

```jsonc
{
  "$schema": "https://vibe-ctl.dev/schemas/plugin/v1.json",

  // ─── Identity ──────────────────────────────────────────────
  "id": "@vibe-ctl/plugin-claude-code",
  "name": "Claude Code",
  "version": "1.0.0",
  "apiVersion": "^1.0.0",

  // ─── Metadata ─────────────────────────────────────────────
  "description": "Claude Code session management",
  "author": { "name": "vibe-ctl", "url": "https://..." },
  "license": "MIT",
  "homepage": "...",
  "repository": "github:vibe-ctl/vibe-ctl",
  "icon": "./assets/icon.svg",

  // ─── Execution ─────────────────────────────────────────────
  "executionContext": "split",          // 'renderer' | 'main' | 'split'
  "entry": {
    "main":     "./dist/main.js",
    "renderer": "./dist/renderer.js"
  },
  "eagerActivation": true,              // Default false (lazy)

  // ─── Engine Compatibility ─────────────────────────────────
  "engines": {
    "vibe-ctl": "^1.0.0",
    "platform": ["darwin", "linux", "win32"]
  },

  // ─── Services Provided ─────────────────────────────────────
  "provides": {
    "claude-code": "1.0.0"
  },

  // ─── Services Required / Optional ─────────────────────────
  "dependencies": {},                   // Empty: claude-code uses kernel mesh, not a plugin
  "optionalDependencies": {
    "themes": "^1.0.0"
  },

  // ─── Wait for Warmup ──────────────────────────────────────
  "waitForReady": [],                   // Hold activation until these services warm up

  // ─── Synced Data (see spec 02 §3, §5) ─────────────────────
  "sync": {
    "settings": true,                   // User-global settings syncs (default true)
    "data": [
      { "name": "session-index", "type": "store", "scope": "per-device" }
    ]
  },

  // ─── Permissions (plain strings) ──────────────────────────
  "permissions": [
    "claude-code:read-transcripts",
    "claude-code:approve",
    "filesystem.state",
    "mesh:broadcast"                    // Required to use ctx.mesh.broadcast()
  ],

  // ─── Host-Provided (bundler marks external) ───────────────
  "hostProvided": [
    "@vibe-ctl/extension-api",
    "react",
    "react-dom",
    "@jamesyong42/infinite-canvas",
    "@jamesyong42/reactive-ecs",
    "@vibecook/truffle"
  ]
}
```

### Zod schema sketch

```typescript
export const PluginManifestSchema = z.object({
  id: z.string().regex(/^(@[a-z0-9-]+\/)?[a-z0-9][a-z0-9._-]*$/),
  name: z.string().min(1).max(80),
  version: z.string().refine(semver.valid),
  apiVersion: z.string().refine(semver.validRange),

  description: z.string().max(500).optional(),
  author: z.union([z.string(), z.object({ name: z.string(), url: z.string().url().optional() })]).optional(),
  license: z.string().optional(),
  homepage: z.string().url().optional(),
  repository: z.string().optional(),
  icon: z.string().optional(),

  executionContext: z.enum(['renderer', 'main', 'split']).default('renderer'),
  entry: z.union([
    z.string(),
    z.object({ main: z.string(), renderer: z.string() }),
  ]),
  eagerActivation: z.boolean().default(false),

  engines: z.object({
    'vibe-ctl': z.string().refine(semver.validRange),
    platform: z.array(z.enum(['darwin', 'linux', 'win32'])).optional(),
  }),

  provides: z.record(z.string(), z.string().refine(semver.valid)).default({}),
  dependencies: z.record(z.string(), z.string().refine(semver.validRange)).default({}),
  optionalDependencies: z.record(z.string(), z.string().refine(semver.validRange)).default({}),
  waitForReady: z.array(z.string()).default([]),

  sync: z.object({
    settings: z.boolean().default(true),
    data: z.array(z.object({
      name: z.string(),
      type: z.enum(['crdt', 'store']),
      scope: z.enum(['user-global', 'per-device']),
    })).default([]),
  }).default({ settings: true, data: [] }),

  permissions: z.array(z.string()).default([]),
  hostProvided: z.array(z.string()).default(DEFAULT_HOST_PROVIDED),
});
```

### Fields dropped from earlier drafts

- `contributes` (widgets/commands/menus/sidePanels/statusItems) — all
  replaced by programmatic `ctx.*.register()` calls
- `activationEvents[]` — single `eagerActivation` boolean
- `tier` in manifest — always source-determined by kernel

---

## 3. Execution Contexts

The kernel picks the process based on this declaration.

### `renderer` (default)

Pure UI plugin. No Node APIs needed. Loaded in the main renderer process.
Fast, direct access to React, DOM, canvas.

**Examples:** themes, device-emulator, command-palette, side-panels.

### `main`

No UI contributions. Needs Node APIs or native modules. Loaded in the
Electron main process (or a utilityProcess if the kernel chooses to
isolate). Rare in practice — most backend-y plugins also want widgets.

### `split` (most common)

Two halves. Main half for services/Node APIs/native modules; renderer
half for widgets/React. Kernel spawns a utilityProcess for the main
half and wires a typed MessagePort between them.

```jsonc
"executionContext": "split",
"entry": {
  "main":     "./dist/main.js",
  "renderer": "./dist/renderer.js"
}
```

**Examples:** claude-code, terminal, notifications.

### Cross-half RPC

The kernel provides a typed RPC channel via `ctx.rpc` (only present in
split plugins). Comlink-style, preserves types:

```typescript
// main.ts
export default class ClaudeCodeMain extends Plugin {
  async onActivate() {
    const api = createSpaghettiService();

    this.ctx.rpc!.expose({
      listProjects: () => api.getProjectList(),
      getSessions: (slug: string) => api.getSessionList(slug),
      readTranscript: (id: string) => api.getSessionMessages(id),
      initializePromise: api.initialize(),
    });
  }
}

// renderer.ts
export default class ClaudeCodeRenderer extends Plugin {
  async onActivate() {
    const main = this.ctx.rpc!.connect<MainApi>();
    // main.listProjects() typed as returning Promise<Project[]>
  }
}
```

Services + widgets are typically exposed in the renderer half so other
plugins' renderer code can consume them without crossing the
process boundary.

---

## 4. Base `Plugin` Class

```typescript
// @vibe-ctl/extension-api

export abstract class Plugin {
  /** Injected by kernel before onActivate. Do NOT use in constructor. */
  readonly ctx!: PluginContext;

  /** Called when the plugin activates. Register contributions here. */
  abstract onActivate(): void | Promise<void>;

  /**
   * Optional: called during deactivation AFTER tracked disposables
   * have been invoked. Use only for resources the tracker can't see
   * (native handles, external processes).
   */
  onDeactivate?(): void | Promise<void>;
}
```

### Minimal example: device-emulator

```typescript
import { Plugin } from '@vibe-ctl/extension-api';
import { z } from 'zod';
import { DeviceEmulatorWidget } from './widget';

const ConfigSchema = z.object({
  url: z.string().url().default('https://example.com'),
  device: z.enum(['iphone-15', 'pixel-8', 'ipad-pro']).default('iphone-15'),
});

export default class DeviceEmulatorPlugin extends Plugin {
  async onActivate() {
    this.ctx.widgets.register({
      type: 'device-emulator',
      component: DeviceEmulatorWidget,
      ownedByPlugin: this.id,
      placements: ['canvas'],
      defaultSize: { width: 400, height: 700 },
      configSchema: ConfigSchema,
    });
  }
}
```

Ten lines. Kernel does the rest.

---

## 5. `PluginContext` API

The `ctx` object injected into every plugin. Scoped to that plugin;
disposables auto-tracked.

```typescript
export interface PluginContext {
  // ─── Identity ──────────────────────────────────────────────
  readonly id: string;
  readonly version: string;
  readonly tier: PluginTier;             // 'T1' | 'T2' | 'T3'
  readonly dataDir: string;              // Plugin's persistent local storage
  readonly logger: Logger;               // Scoped, shown in plugin dev panel
  readonly signal: AbortSignal;          // Aborts on deactivate

  // ─── Resource Tracking ─────────────────────────────────────
  track<T extends Disposable>(d: T): T;

  // ─── Registration APIs ─────────────────────────────────────
  widgets: WidgetRegistry;
  commands: CommandRegistry;
  keybindings: KeybindingRegistry;
  menus: MenuRegistry;
  themes: ThemeRegistry;

  // ─── Event Bus ─────────────────────────────────────────────
  on<E extends keyof VibeEvents>(event: E, handler: (p: VibeEvents[E]) => void): Disposable;
  emit<E extends keyof VibeEvents>(event: E, payload: VibeEvents[E]): void;

  // ─── Services ──────────────────────────────────────────────
  services: ServiceRegistry;

  // ─── Canvas (high-level shortcut; writes to kernel/canvas-layout) ──
  canvas: CanvasAPI;

  // ─── Sync (per spec 02 §3, §5) ─────────────────────────────
  sync: SyncAPI;

  // ─── Mesh (kernel-provided; safe façade over NapiNode) ─────
  mesh: MeshAPI;

  // ─── Cross-half RPC (only in split plugins) ────────────────
  rpc?: PluginRPC;

  // ─── Settings & Storage ────────────────────────────────────
  settings: SettingsAPI;                 // User-global (backed by kernel/user-settings CRDT)
  storage: StorageAPI;                   // Per-plugin local-only key-value

  // ─── UI Primitives ─────────────────────────────────────────
  ui: UI;

  // ─── Permissions ───────────────────────────────────────────
  permissions: PermissionAPI;
}
```

The kernel-level APIs (canvas, sync, mesh, settings, storage, permissions)
are the plugin's main cross-plugin surface. Services + widgets extend
behavior.

---

## 6. Widget System

Widgets are the universal UI primitive. Status bar items, side panel
contents, canvas widgets — all widgets with different placements.

### Registration

```typescript
interface WidgetDef<Config = unknown> {
  type: string;                          // Unique within the plugin
  component: React.ComponentType<WidgetProps<Config>> | R3FComponent;
  renderer?: 'react' | 'r3f';            // Default: 'react'
  ownedByPlugin: string;                 // The plugin ID that owns this widget

  placements: WidgetPlacement[];         // Where users can place it
  defaultSize?: { width: number; height: number };
  minSize?: { width: number; height: number };

  configSchema?: ZodSchema<Config>;      // Per-widget user config
  defaultConfig?: Config;
}

type WidgetPlacement =
  | 'canvas'
  | 'side-panel:left'
  | 'side-panel:right'
  | 'status-bar:left'
  | 'status-bar:right'
  | 'command-palette'                    // Palette result rows
  | 'notification-surface'
  | `custom:${string}`;                  // Plugins can contribute new slots
```

### Widget props

```typescript
interface WidgetProps<Config = unknown> {
  config: Config;
  setConfig: (partial: Partial<Config>) => void;
  width: number;
  height: number;
  breakpoint: Breakpoint;                // 'micro' | 'compact' | 'normal' | 'expanded' | 'detailed'
  placement: WidgetPlacement;
}
```

### Widget hooks

```tsx
import { useWidgetConfig, useWidgetPlugin, useService, useUI } from '@vibe-ctl/extension-api';

function ProjectListWidget() {
  const [config, setConfig] = useWidgetConfig<Config>();
  const plugin = useWidgetPlugin<ClaudeCodePlugin>();  // own plugin, direct access
  const ui = useUI();
  const projects = useAsync(() => plugin.listProjects());

  return (
    <ui.Panel title="Projects">
      <ui.List
        items={projects.value ?? []}
        renderItem={(p) => <ui.ListItem label={p.displayName} />}
      />
    </ui.Panel>
  );
}
```

Key distinction:
- **`useWidgetPlugin<T>()`**: only works for widgets where `ownedByPlugin`
  matches the current plugin. Direct reference, no façade, no permission
  check.
- **`useService<T>('id')`**: for any plugin's services. Goes through
  service proxy with tier + permission checks.

### Shared UI primitives (`ctx.ui` / `useUI()`)

Host-provided React components:

```typescript
interface UI {
  Panel: React.FC<{ title?: string; toolbar?: React.ReactNode; children: React.ReactNode }>;
  Button: React.FC<{ variant?: 'primary' | 'secondary' | 'ghost'; icon?: string; onClick: () => void; children: React.ReactNode }>;
  Input: React.FC<{ value: string; onChange: (v: string) => void; placeholder?: string }>;
  Select: React.FC<{ value: string; options: Array<{ value: string; label: string }>; onChange: (v: string) => void }>;
  List: React.FC<{ items: unknown[]; renderItem: (item: unknown, idx: number) => React.ReactNode }>;
  ListItem: React.FC<{ label: string; sublabel?: string; icon?: string; onClick?: () => void; selected?: boolean }>;
  Modal: React.FC<{ title: string; open: boolean; onClose: () => void; children: React.ReactNode }>;
  Tooltip: React.FC<{ content: string; children: React.ReactNode }>;
  Icon: React.FC<{ name: string; size?: number }>;
  Badge: React.FC<{ variant?: 'default' | 'success' | 'warn' | 'error'; children: React.ReactNode }>;
  Spinner: React.FC<{ size?: number }>;
  Separator: React.FC;
}
```

### R3F widgets

For widgets rendered on infinite-canvas's WebGL layer:

```typescript
ctx.widgets.register({
  type: 'my-3d-widget',
  renderer: 'r3f',
  component: My3DWidget,
  ownedByPlugin: this.id,
  placements: ['canvas'],
});
```

R3F widgets render within the canvas's R3F scene graph.

---

## 7. Service Registry with Warmup

### Providing

```typescript
interface ProvideOpts {
  /** If given, consumers see isReady() === false until this resolves. */
  warmup?: Promise<void>;
  /** Restrict which tiers can require() this service. */
  tierRestriction?: PluginTier;
}

ctx.services.provide('claude-code', impl, {
  warmup: api.initialize(),
});
```

### Service interface should expose readiness

```typescript
interface ClaudeCodeServiceV1 {
  readonly version: '1.0.0';
  isReady(): boolean;
  onReady(cb: () => void): Disposable;

  // Read-only queries
  listProjects(): Promise<Project[]>;
  getSessions(projectSlug: string): Promise<Session[]>;

  // Permission-gated (façade enforces)
  readTranscript(sessionId: string): Promise<Message[]>;
  approve(sessionId: string, requestId: string): Promise<void>;

  // Observables
  onSessionChange(cb: (e: SessionChangeEvent) => void): Disposable;
}
```

### Requiring

```typescript
declare module '@vibe-ctl/extension-api' {
  interface VibeServices {
    'claude-code': ClaudeCodeServiceV1;
    'terminal': TerminalServiceV1;
    // ... each plugin's npm package extends this via declaration merging
  }
}

const cc = ctx.services.require('claude-code');       // typed from merged interface
const themes = ctx.services.optional('themes');       // ServiceProxy | null
```

### Proxy semantics

The registry hands out proxies:
- Forward calls while provider is active
- Throw `ServiceUnavailable` if provider deactivates
- Throw `ServiceAccessDenied` if tier gate fails
- Throw `IncompatibleServiceVersion` on range mismatch
- Emit `unavailable` events consumers can subscribe to

---

## 8. Sync and Mesh APIs

These are how plugins reach across devices. See spec 02 §3–§5 for the
full model.

### `ctx.sync` — synced data

```typescript
interface SyncAPI {
  /**
   * Access a CRDT document declared in manifest's sync.data[] with type: 'crdt'.
   * Returns a Loro document scoped to the plugin. Concurrent edits merge.
   */
  crdtDoc(name: string): CrdtDoc;

  /**
   * Access a SyncedStore declared in manifest's sync.data[] with type: 'store'.
   * Each device owns one slice. Others read via store.all().
   */
  syncedStore<T>(name: string): SyncedStore<T>;
}
```

**Declared names are strict.** Calling `ctx.sync.crdtDoc('foo')` when
`foo` isn't in `manifest.sync.data[]` throws. This forces discoverability
(users see what syncs at install time) and prevents accidental leaks.

Naming is auto-namespaced: the underlying doc ID is
`plugin:{pluginId}:{name}`.

### Example

```typescript
// In manifest:
"sync": {
  "data": [
    { "name": "bookmarks", "type": "crdt", "scope": "user-global" }
  ]
}

// In plugin code:
async onActivate() {
  const bookmarks = ctx.sync.crdtDoc('bookmarks');
  const map = bookmarks.getMap('items');
  map.set('b1', { url: '...', title: '...' });
  // Deltas broadcast automatically; other devices' plugins see the update
  // via Loro's subscribe() (reactive-ecs makes this automatic for widgets)
}
```

### `ctx.mesh` — direct mesh messaging

For plugins that need more than CRDT/SyncedStore (e.g., real-time streams,
peer-to-peer commands, port proxying):

```typescript
interface MeshAPI {
  /** List currently-online peers on the mesh. */
  peers(): Peer[];

  /** Subscribe to peer join/leave events. */
  onPeerChange(cb: (event: PeerEvent) => void): Disposable;

  /**
   * Broadcast to all peers. Namespace is auto-prefixed to the plugin
   * (e.g., calling with 'messages' becomes 'plugin:{pluginId}:messages'
   * on the wire). Prevents plugin impersonation.
   */
  broadcast(namespace: string, data: unknown): Promise<void>;

  /** Send to a specific peer. Same namespace scoping as broadcast. */
  send(peerId: string, namespace: string, data: unknown): Promise<void>;

  /** Subscribe to messages in this plugin's namespace. */
  subscribe(namespace: string, handler: MessageHandler): Disposable;

  /** Expose a local port across the mesh (uses truffle proxy feature). */
  proxyPort(opts: { listenPort: number; targetPort: number; protocol: 'http' | 'https' | 'tcp' }): Disposable;
}
```

Permissions required to use `ctx.mesh`:
- `mesh:broadcast` — to call `broadcast()` / `send()`
- `mesh:proxy` — to call `proxyPort()`
- Reading peers + subscribing doesn't require permission (discovery only)

### Example: terminal plugin using mesh for live PTY streaming

```typescript
// After a user on device B clicks "view remote session" for a PTY running on A,
// terminal plugin on B needs to receive PTY bytes in real-time.
// CRDT/SyncedStore are too coarse — we need low-latency streaming.

ctx.mesh.subscribe('pty-stream', (msg) => {
  const { sessionId, bytes } = msg.data;
  if (watchedSessionIds.has(sessionId)) {
    routeToViewerWidget(sessionId, bytes);
  }
});

// On the owning device, forward PTY output:
ptySession.onData(bytes => {
  if (watcherPeerIds.size > 0) {
    for (const peerId of watcherPeerIds) {
      ctx.mesh.send(peerId, 'pty-stream', { sessionId, bytes });
    }
  }
});
```

### Note: no direct `NapiNode` access

Plugins never receive the raw `NapiNode`. That's T0-only (kernel).
Plugins interact through `ctx.sync`, `ctx.mesh`, and the services other
plugins provide.

---

## 9. Permissions

Declared in manifest. Checked in service façade methods or before using
elevated kernel APIs:

```typescript
async readTranscript(sessionId: string): Promise<Message[]> {
  await this.ctx.permissions.require('claude-code:read-transcripts');
  // require() either prompts (first time) or throws PermissionDenied
  return this.api.getSessionMessages(sessionId);
}
```

### Lifecycle

1. Plugin declares in manifest
2. At install, user sees the list (informational)
3. First call to `permissions.require('x')`: kernel prompts with the
   reason string; decision persisted
4. Revisit in Settings → Plugins → {plugin} → Permissions

### Tier shortcuts

- **T1** (bundled): all declared permissions implicitly granted
- **T2** (verified): shown at install; prompted first-use for sensitive
- **T3** (community): shown at install with warning; prompted every first-use

### Cross-device behavior

See spec 02 §9. Grants stay local; revocations sync. A revocation on
any device reduces capability everywhere.

### Naming convention

```
<plugin-id>:<action>                     // Plugin-specific
<system-category>                         // Kernel-owned
```

Examples:
- `claude-code:read-transcripts`
- `claude-code:approve`
- `terminal:spawn`
- `filesystem.state` — plugin's own `ctx.dataDir`
- `filesystem.workspace` — user-selected workspace
- `network` — outbound HTTPS
- `mesh:broadcast` — use `ctx.mesh.broadcast()` / `.send()`
- `mesh:proxy` — use `ctx.mesh.proxyPort()`
- `notifications` — show OS notifications
- `clipboard:read`, `clipboard:write`

Strings only. No hierarchy. No patterns.

---

## 10. Activation: Eager vs Lazy

One boolean:

```jsonc
"eagerActivation": true   // Activate at startup (after sync fabric + kernel version check)
"eagerActivation": false  // Activate on first use (default)
```

### First-use triggers (for lazy plugins)

- Another plugin calls `ctx.services.require(id)` where `id` is in this
  plugin's `provides`
- A user places a widget on the canvas whose type this plugin registered
- A command this plugin registered is executed

Event-triggered lazy activation is not supported; use `eagerActivation: true`
if you need to observe events from app start.

### When eager is necessary

- Plugin provides a service others need at startup
- Plugin registers a widget visible in the default canvas
- Plugin must observe events from boot

Default is false. The plugin manager UI surfaces a warning for plugins
that set eager without a strong reason.

---

## 11. Disposable Tracking

All `ctx.*.register()` calls auto-track their returned disposables. Use
`ctx.track(d)` for anything you create that needs cleanup on deactivate.

Deactivation sequence:
1. `AbortSignal` fires (aborts in-flight fetches, async)
2. `onDeactivate()` called, 5s timeout
3. Provided services invalidated (consumer proxies go dead)
4. Tracked disposables disposed in reverse registration order
5. Plugin state set to 'disabled'

---

## 12. `VibeEvents` Event Catalog

Kernel-owned events. Plugins extend via declaration merging.

```typescript
interface VibeEvents {
  'app.startup':     { version: string };
  'app.shutdown':    void;

  'plugin.activated':    { pluginId: string };
  'plugin.deactivated':  { pluginId: string };
  'plugin.error':        { pluginId: string; error: Error };

  'service.available':   { serviceId: string; providerId: string };
  'service.ready':       { serviceId: string };       // warmup done
  'service.unavailable': { serviceId: string };

  'canvas.widget.added':   { widgetId: string; type: string; placement: WidgetPlacement };
  'canvas.widget.removed': { widgetId: string };
  'canvas.viewport.changed': { x: number; y: number; zoom: number };

  'command.executed':    { commandId: string; args: unknown[] };

  'settings.changed':    { pluginId: string; key: string; value: unknown };
  'permission.granted':  { pluginId: string; permission: string };
  'permission.revoked':  { pluginId: string; permission: string };

  'mesh.peer.joined':    { peerId: string; deviceName: string };
  'mesh.peer.left':      { peerId: string };
  'mesh.status.changed': { connected: boolean; peerCount: number };

  // Plugins extend via declaration merging in their own npm package:
  // declare module '@vibe-ctl/extension-api' {
  //   interface VibeEvents {
  //     'claude-code.hook': HookEvent;
  //   }
  // }
}
```

---

## 13. Worked Examples

### 13.1 Claude Code — heavy, split, provides service + widgets, syncs per-device session index

```jsonc
// plugins/claude-code/plugin.json
{
  "id": "@vibe-ctl/plugin-claude-code",
  "name": "Claude Code",
  "version": "1.0.0",
  "apiVersion": "^1.0.0",
  "executionContext": "split",
  "entry": { "main": "./dist/main.js", "renderer": "./dist/renderer.js" },
  "eagerActivation": true,
  "engines": { "vibe-ctl": "^1.0.0" },
  "provides": { "claude-code": "1.0.0" },
  "sync": {
    "settings": true,
    "data": [
      { "name": "session-index", "type": "store", "scope": "per-device" }
    ]
  },
  "permissions": [
    "claude-code:read-transcripts",
    "claude-code:approve",
    "filesystem.state"
  ]
}
```

```typescript
// plugins/claude-code/src/main.ts
import { createSpaghettiService, createHookEventWatcher } from '@vibecook/spaghetti-sdk';

export default class ClaudeCodeMain extends Plugin {
  async onActivate() {
    const api = createSpaghettiService();
    const watcher = createHookEventWatcher();
    this.ctx.track(watcher);
    await watcher.start();
    watcher.onEvent(e => this.ctx.emit('claude-code.hook', e));

    this.ctx.rpc!.expose({
      listProjects: () => api.getProjectList(),
      getSessions: (slug) => api.getSessionList(slug),
      readTranscript: (id) => api.getSessionMessages(id),
      initializePromise: api.initialize(),
    });
  }
}
```

```typescript
// plugins/claude-code/src/renderer.ts
export default class ClaudeCodeRenderer extends Plugin {
  async onActivate() {
    const main = this.ctx.rpc!.connect<MainApi>();

    // Publish a per-device index of projects for cross-device views
    const sessionIndex = this.ctx.sync.syncedStore<SessionIndex>('session-index');
    main.initializePromise.then(async () => {
      const projects = await main.listProjects();
      sessionIndex.set({
        deviceId: this.ctx.deviceId,
        deviceName: this.ctx.deviceName,
        projects: projects.map(p => ({ slug: p.slug, sessionCount: p.sessions.length })),
      });
    });

    const service: ClaudeCodeServiceV1 = {
      version: '1.0.0',
      isReady: () => main.ready,
      onReady: (cb) => main.onReady(cb),
      listProjects: () => main.listProjects(),
      getSessions: (slug) => main.getSessions(slug),
      readTranscript: async (id) => {
        await this.ctx.permissions.require('claude-code:read-transcripts');
        return main.readTranscript(id);
      },
      onHookEvent: (cb) => this.ctx.on('claude-code.hook', cb),
    };

    this.ctx.services.provide('claude-code', service, {
      warmup: main.initializePromise,
    });

    this.ctx.widgets.register({
      type: 'project-list',
      component: ProjectListWidget,
      ownedByPlugin: this.id,
      placements: ['canvas', 'side-panel:left'],
      defaultSize: { width: 320, height: 480 },
    });
  }
}
```

### 13.2 Terminal — split, optional mesh-driven remote viewing

```jsonc
{
  "id": "@vibe-ctl/plugin-terminal",
  "executionContext": "split",
  "entry": { "main": "./dist/main.js", "renderer": "./dist/renderer.js" },
  "eagerActivation": false,
  "provides": { "terminal": "1.0.0" },
  "sync": {
    "data": [
      { "name": "sessions", "type": "store", "scope": "per-device" }
    ]
  },
  "permissions": ["terminal:spawn", "mesh:broadcast"]
}
```

Lazy-activates on first `ctx.services.require('terminal')` or first
terminal widget placement. Uses `ctx.sync.syncedStore('sessions')` to
publish metadata of local PTYs. Uses `ctx.mesh.subscribe('pty-stream')`
to receive remote PTY bytes when a user views a remote session.

### 13.3 Device Emulator — pure renderer, tiny

```jsonc
{
  "id": "@vibe-ctl/plugin-device-emulator",
  "executionContext": "renderer",
  "entry": "./dist/index.js",
  "eagerActivation": false
}
```

```typescript
export default class DeviceEmulatorPlugin extends Plugin {
  async onActivate() {
    this.ctx.widgets.register({
      type: 'device-emulator',
      component: DeviceEmulatorWidget,
      ownedByPlugin: this.id,
      placements: ['canvas'],
      defaultSize: { width: 400, height: 700 },
      configSchema: z.object({
        url: z.string().url().default('https://example.com'),
        device: z.enum(['iphone-15', 'pixel-8', 'ipad-pro']).default('iphone-15'),
      }),
    });
  }
}
```

Fifteen lines. No services, no sync, no permissions. Just a widget.

---

## Decisions

- **`ctx.ui` is types-only in `@vibe-ctl/extension-api`; components come
  through `ctx.ui` at runtime.** Keeps the published API package tiny (no
  React dep for authors using types only). Host can version components
  without breaking plugins.
- **Split plugin crash recovery: auto-restart main half up to 3× with
  exponential backoff, then mark Failed.** User re-enables manually from
  plugin manager. Balances transient-crash recovery against infinite loops.
- **Third-party widget placements: not in v1.** Requires dynamic
  layout-slot machinery in the shell. Built-in placements (canvas,
  side-panel:*, status-bar:*, command-palette, notification-surface)
  suffice for months.
- **`ctx.rpc` uses Comlink.** 2KB minified, battle-tested, excellent
  TypeScript ergonomics. Writing our own typed MessagePort layer
  reinvents it.
- **Permission grants persist across plugin versions; only new
  permissions prompt on update.** Chrome's model. If v1.1 adds `C` to
  existing `[A, B]`, prompt for `C`, preserve `A`/`B`. Deprecated
  permissions drop silently.
- **Only `ctx.settings.*` accesses synced user settings.** No
  `ctx.sync.settings`. Single source of truth; kernel owns the sync doc
  name for settings.
