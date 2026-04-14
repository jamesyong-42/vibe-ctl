# 02 -- Kernel Runtime

> What the kernel is responsible for and what it exposes.
> Tight version built around three sync principles and one concrete
> walkthrough.

**Depends on:** `01-extension-system.md`

---

## 1. Three Layers

```
┌─────────────────────────────────────────────────────────────┐
│  Layer 3: Plugin Host                                        │
│  Discovery, lifecycle, service registry, activation,         │
│  teardown, ctx construction, permissions                     │
├─────────────────────────────────────────────────────────────┤
│  Layer 2: Sync Fabric                                        │
│  Mesh network (truffle), CrdtDoc, SyncedStore primitives,    │
│  four kernel-managed shared docs                             │
├─────────────────────────────────────────────────────────────┤
│  Layer 1: Platform                                           │
│  Electron shell, windows, tray, menu, canvas substrate,      │
│  process management (utilityProcess, child_process)          │
└─────────────────────────────────────────────────────────────┘
```

Everything else is a plugin. No domain logic in the kernel.

---

## 2. Platform Layer

Electron + infinite-canvas substrate. Responsibilities:

- Main process, windows, tray, menu, OS integration
- Canvas engine (wraps `@jamesyong42/infinite-canvas`)
- Process management: utilityProcess (for split plugins), child_process
  (for helpers like NotchHelper)
- Host-provided module resolution (singletons for React, truffle, canvas,
  reactive-ecs)

---

## 3. Sync Fabric: Three Principles

The entire sync model reduces to three rules. Every policy decision
derives from these.

### 3.1 Presentation syncs; runtime doesn't

| Syncs | Doesn't sync |
|---|---|
| Canvas layout (widget positions, configs) | Running services, process state |
| User settings, themes | PTY processes, node-pty lifecycle |
| Permission grant decisions | Mesh connection state |
| Plugin inventory metadata | Agent session transcripts |

Rule of thumb: if a user could observe it *looking at their screen*,
it's presentation and should sync. If it's a live resource (a process,
a TCP connection, an in-memory object), it stays local.

### 3.2 Devices own their truth

Each device publishes what's true *about itself* via its own SyncedStore
slice. Others read that truth but never write it.

- "What plugins do I have installed?" → my slice of `kernel/plugin-inventory`
- "What PTY sessions am I running?" → terminal plugin's device slice
- "What projects exist on my filesystem?" → claude-code plugin's device slice
- "What permission grants have I authorized?" → each device owns its grants

Other devices can *view* these slices, *merge* them into composite views
("show all PTY sessions across my devices"), but cannot mutate another
device's slice. This is SyncedStore's design: device-owned slices, LWW
by monotonic version.

### 3.3 State flows reactively; UI subscribes

All kernel state lives in an ECS world (reactive-ecs). UI components
subscribe to queries, not to event streams. When sync deltas arrive,
they mutate components; reactive queries re-fire; widgets re-render.

Plugin authors never write sync code. They register widgets and
services. The reactive substrate handles the rest.

---

## 4. The Four Kernel-Managed Docs

| Doc | Primitive | What it holds |
|---|---|---|
| `kernel/plugin-inventory` | SyncedStore | Per-device: `{ installed: PluginRef[], enabled: string[] }` |
| `kernel/canvas-layout` | CrdtDoc (Loro Map) | Widget entries: `{ type, placement, position, size, config, parentId }` |
| `kernel/user-settings` | CrdtDoc (Loro Map) | User-global preferences keyed by `{pluginId}.{key}` |
| `kernel/permissions` | CrdtDoc (Loro Map) | Grant/revoke decisions keyed by `{pluginId}:{permission}` |

All four exist from app boot. Persist via truffle's snapshot backend.
Sync automatically. Kernel writes to these in response to user actions;
plugins never mutate them directly (they mutate indirectly through
`ctx.canvas.addWidget()`, `ctx.settings.update()`, etc.).

### 4.1 Kernel Version is Authoritative

Every shared doc carries a `minKernelVersion` field. At app launch, the
kernel checks its own version against every peer's most-recently-seen
`minKernelVersion`:

- If our version meets every peer's minimum: proceed normally.
- If our version is behind: show a blocking "Update required" screen
  and refuse to start the plugin host or open sync docs for mutation.
  This prevents an older client from corrupting CRDTs authored by a
  newer client.

Consequence: within the mesh, kernel versions are monotonically
non-decreasing. Users who don't upgrade simply can't use the app on
that machine until they do. This is Discord's model and it buys us
enormous simplification — no cross-version CRDT compat layer needed.

Plugin API versions (`apiVersion` in the manifest) are still checked
independently per-plugin at activation. Plugin version mismatches
across devices (device A has X v1.2, device B has X v1.3) remain
per-device and are user-reconciled in the plugin manager, as described
in §9.

### 4.2 Canvas-Sync Adapter

The `kernel/canvas-layout` CrdtDoc is bridged to the canvas ECS world
(owned by `@jamesyong42/infinite-canvas`) by an adapter inside
`core/runtime/src/canvas-sync/`.

Responsibilities:
- **Filter:** only entities with the `Widget` component sync. Transient
  UI entities (resize handles, snap guides, hit regions) stay local.
- **Serialize local → remote:** subscribed to the canvas engine's
  `onFrame` hook. Each frame reads `getFrameChanges()` (positions,
  creations, deletions) and applies the matching deltas to the
  Loro doc. Uses `serializeEntities(...)` for new entities.
- **Apply remote → local:** subscribed to the Loro doc's update stream.
  Incoming deltas are applied to the canvas world via the engine's
  command API, wrapped in a `remoteApplying = true` flag.
- **Echo suppression:** when the adapter reads `getFrameChanges()`, it
  skips frames flagged as remote-applying. Prevents the local-write
  round-trip.

The adapter is internal to vibe-ctl. Infinite-canvas stays sync-agnostic
and usable in other contexts (local-only apps, other CRDT libs). The
library already exposes `registerSystem`, `removeSystem`, `serializeWorld`,
`deserializeWorld`, and `serializeEntities` — no further library changes
needed for this to work.

---

## 5. Plugin Sync API

Plugins declare their sync intent in manifest:

```jsonc
"sync": {
  "settings": true,                      // default true
  "data": [
    { "name": "bookmarks", "type": "crdt",  "scope": "user-global" },
    { "name": "sessions",  "type": "store", "scope": "per-device" }
  ]
}
```

Kernel pre-provisions named docs before activation:

```typescript
// In onActivate:
const bookmarks = ctx.sync.crdtDoc('bookmarks');    // LoroDoc
const sessions  = ctx.sync.syncedStore('sessions'); // SyncedStore
```

Doc IDs are auto-namespaced: `plugin:{pluginId}:{name}`. Undeclared
names throw (force manifest declaration).

---

## 6. Walkthrough: Terminal Plugin Across Two Machines

### 6.1 User installs terminal plugin on Machine A

```
A: User clicks Install
   ↓
A: Kernel downloads to ~/.vibe-ctl/plugins/
   ↓
A: ECS kernel world: createEntity with
   PluginManifest, PluginSource, PluginState='discovered'
   ↓
A: plugin-inventory slice updated:
   { installed: [...existing, terminal v1.0.0] }
   ↓
A: truffle broadcasts slice ───────────────► B: slice merges
                                              ↓
                                              B: ECS query
                                                "plugins peers have, I don't"
                                                re-fires, returns terminal
                                              ↓
                                              B: Status bar badge:
                                                "1 plugin available on peers"
                                                (non-blocking, ignorable)
A: Plugin activates (eager)
   Split: main half in utilityProcess,
   renderer half in renderer
   ↓
A (main): PTYSessionManager created
          PTYMeshBridge({ node: kernelNode,
                          sessionManager })
          Subscribes to 'pty' namespace
          Subscribes to PTYSyncStore
   ↓
A (renderer):
   ctx.widgets.register({
     type: 'terminal-session-monitor',
     component: SessionMonitorWidget,
     ownedByPlugin: '@vibe-ctl/plugin-terminal'
   })
   ctx.services.provide('terminal', facade)
   ↓
A: ECS WidgetTypeRegistry changes
   → widget tray query re-fires
   → user sees new draggable widget
   ↓
A: User drags onto canvas
   ↓
A: canvas-layout CRDT insert:
   widget-7: { type: 'terminal:session-monitor', ... }
   ↓
A: CRDT delta broadcasts ──────────────────► B: delta applies
                                              ↓
                                              B: canvas engine sees widget-7
                                              ↓
                                              B: WidgetTypeRegistry has no
                                                entry for 'terminal:...'
                                                (plugin not installed here)
                                              ↓
                                              B: Renders MissingPluginPlaceholder
                                                ┌──────────────────────┐
                                                │ ⚠ terminal plugin    │
                                                │ [Install]  [Remove]  │
                                                └──────────────────────┘
A: Widget renders
   Queries local sessions (0) +
   remote via PTYSyncStore (0)
   → "No sessions yet"
```

### 6.2 User clicks [Install] on the placeholder (Machine B)

```
B: Kernel downloads terminal plugin
   ↓
B: Plugin activates
   ↓
B: ctx.widgets.register('terminal-session-monitor')
   ↓
B: WidgetTypeRegistry gains the entry
   → canvas engine query for widget-7 re-fires
   → placeholder component replaced with
     real SessionMonitorWidget (no re-layout,
     no position change)
```

### 6.3 User spawns a PTY on Machine A

```
A: PTYSessionManager.createSession({ cwd, shell })
   ↓
A: node-pty spawns real process
   ↓
A: PTYSyncStore (per-device slice) updated:
   { sessions: [{ id, cwd, cols, rows }] }
   ↓
A: truffle broadcasts ─────────────────────► B: slice merges
                                              ↓
                                              B: terminal plugin subscribed
                                                to PTYSyncStore
                                              ↓
                                              B: ECS component on monitor
                                                widget entity updates
                                              ↓
                                              B: widget's useEcsQuery re-fires
                                              ↓
                                              B: Widget re-renders:
                                                Local: 0
                                                Remote: 1 (from mac-john)
                                                  └ bash in ~/projects/x
```

The PTY process exists only on A (principle 3.1). Its *metadata* flows
via slice publication (principle 3.2). Both widgets update automatically
(principle 3.3).

If user on B clicks the remote session, avocado's mesh transport streams
PTY bytes live over truffle on demand. That's not sync — it's negotiated
live viewing.

### 6.4 Plugin author wrote zero sync code

- No `onDeviceAAdded(session)` handler
- No `syncToOtherDevices(...)` call
- No manual state reconciliation
- No event subscriptions with manual cleanup

The plugin registered a widget, registered a service, and subscribed to
avocado's existing SyncedStore patterns. Cross-device behavior emerged
from the substrate.

---

## 7. ECS at the Kernel Level

The kernel uses `@jamesyong42/reactive-ecs` for state management. Two
worlds share the runtime:

- **Canvas World** (owned by `@jamesyong42/infinite-canvas`): widget
  instances, spatial data, selection, breakpoints. Plugins can register
  systems and components here via the canvas API.
- **Kernel World** (owned by `@vibe-ctl/runtime`): plugin entities,
  services, commands, widget type registry, permission grants.
  **Internal to kernel.** Plugins never query this directly; they use
  `ctx.*` which is backed by ECS internally.

Host-provided: `@jamesyong42/reactive-ecs` is in the `hostProvided`
list so both worlds share one runtime. Plugins that register canvas
systems use the same ECS library they'd use standalone.

**Typical kernel entities and components:**

```typescript
// Plugin entities
PluginManifest, PluginSource, PluginModule, PluginInstance,
PluginState, PluginHealth, PluginDeps, PluginDisposables

// Plus tags: Disabled, Failed, NeedsUpdate

// Services as entities
ServiceEntry: { id, version, providerId, warmup, tierRestriction, proxies }

// Widget type registry entries
WidgetType: { type, ownedByPlugin, placements, component, configSchema }

// Permission grants (reactive query: all grants for plugin X)
PermissionGrant: { pluginId, permission, grantedAt, revokedAt? }
```

**Typical kernel systems (topologically ordered):**

```
DiscoverySystem → DependencyResolutionSystem → ActivationSystem
  → HealthMonitorSystem → SyncBridgeSystem → DeactivationSystem
```

The `SyncBridgeSystem` mirrors the four kernel-managed docs into ECS
components so reactive queries see sync updates as component changes.

### 7.1 Why ECS earns its keep

Every scenario in §6 required zero manual subscription code because of
reactive queries. UI components subscribe to queries; when the bridge
system mutates components (because truffle delivered a slice or CRDT
delta), queries re-fire. Without ECS, each of those transitions needs
its own event bus plumbing.

### 7.2 What doesn't go in ECS

Not everything is an entity. The NapiNode is a singleton; the Electron
main process is a singleton; sync docs themselves are Loro objects
backed by the sync fabric. Only "many-of-same-kind with varying state"
goes in ECS.

---

## 8. Plugin Host

Discovery scans three dirs in priority order:
1. `{app.resources}/plugins/` → built-in (T1)
2. `{userData}/plugins/` → user-installed (T2/T3)
3. `$VIBE_CTL_DEV_PLUGINS` → dev symlinks (T3, hot-reload)

Tier is source-determined, never from manifest.

**Dependency resolution:** topological sort across service dependencies.
Cycles fail. Missing non-optional deps fail. Handled by
`DependencyResolutionSystem`.

**Activation triggers:**
- `eagerActivation: true` → activate at startup (after sync fabric ready)
- Else lazy: first `services.require`, first widget placed, first
  command executed.

**State machine:** `loaded → activating → active-warming → active-ready`
(or `→ deactivating → disabled` / `→ error`).

**Split plugins:** manifest declares `entry.main` + `entry.renderer`.
Kernel spawns utilityProcess for main, loads renderer alongside others,
wires MessageChannel. `ctx.rpc` exposes typed Comlink-style cross-half
RPC.

**Teardown:** reverse topological. AbortSignal fires → `onDeactivate`
(5s timeout) → services invalidated → disposables disposed in reverse
registration order → state to `disabled`.

See §6 of spec 01 for plugin-facing details.

---

## 9. Edge Case Policies (terse)

Each derives from one or more of the three sync principles.

| Case | Behavior | Principle |
|---|---|---|
| Plugin uninstalled on A | Only A's inventory slice changes. B's widgets stay on canvas as placeholders (the canvas CRDT is unchanged). | 3.1, 3.2 |
| Optional: "match plugins" mode | Opt-in per-device setting. When on, install/uninstall on A prompts on B (non-silent, user confirms). | 3.2 |
| Permission grant on A | Stays local to A. B must grant separately. (Security: compromised device can't escalate trust elsewhere.) | 3.2 |
| Permission revocation on A | Propagates: B's grant is invalidated. Revocations can only reduce capability, safe to sync. | 3.1 |
| Plugin version differs across devices | Each device owns its version. Plugin manager UI displays divergence; user can click "match to [device]". Never automatic. | 3.2 |
| Kernel version behind peers | App refuses to start (blocking "Update required" screen). No cross-version CRDT work. Discord-style forced upgrade. | §4.1 |
| Undeclared `ctx.sync.crdtDoc('foo')` | Throws. Plugin must declare all synced docs in manifest `sync.data[]`. | (hygiene) |
| First-sync delay | No blocking. UI opens immediately with local state; deltas apply reactively as they arrive. | 3.3 |
| Missing plugin widget on canvas | Render `MissingPluginPlaceholder` with `[Install]` / `[Remove]` actions. | 3.1 |
| Schema changes in kernel-managed docs | Schema evolves with kernel version. Because kernel version is authoritative (§4.1), a new app version writes the new schema; older clients can't connect until they upgrade. No runtime migration layer. | §4.1 |
| Offline mode | Settings → Sync → disable truffle entirely, or selective per-category + per-plugin opt-out list. | (user choice) |

---

## 10. Bootstrap Sequence

```
1. Electron main starts
2. Platform layer initializes
   (windows, tray, menu, canvas substrate ready)
3. Sync fabric starts
   (truffle NapiNode starts, joins tailnet,
    opens four kernel/* docs, waits briefly
    for first deltas — NON-blocking)
4. Kernel version compat check
   (read peers' minKernelVersion from recent
    doc metadata; if this app is behind,
    show blocking "Update required" screen
    and ABORT the rest of boot)
5. Canvas-sync adapter wires canvas ECS ↔
   kernel/canvas-layout doc
6. Plugin host scans plugin dirs,
   creates ECS entities,
   resolves dependency graph,
   identifies "on peers, not local" plugins
7. Main window renders
   (onboarding badge if missing-plugin diffs exist;
    canvas layout applied with placeholders
    for not-yet-installed widget types)
8. Eager plugins activate in topo order
   (services with warmup flagged; dependents
    waiting for warmup paused)
9. Steady state; reactive queries drive UI
10. On quit: reverse-topo deactivation;
    sync fabric flushes; truffle stops
```

---

## 11. Invariants

1. Exactly one `NapiNode` per app. Kernel creates it.
2. Exactly one instance of each service, via registry.
3. Canvas layout CRDT is the sole source of truth for what renders.
4. The four kernel docs always exist (empty is fine).
5. Tier is source-determined; manifest field never trusted.
6. Plugins write only to their own namespace (scoped APIs enforce).
7. Permissions consulted before sensitive operations (via façades).
8. Deactivation always completes (hard timeout forces it).
9. ECS kernel world is internal; plugins never query it directly.
10. Reactive queries are the only UI update mechanism; no ad-hoc event
    subscriptions for kernel state.

---

## Decisions

- **`minKernelVersion` lives in a dedicated `kernel/version-beacons`
  SyncedStore slice.** Each device publishes its current kernel version.
  Boot-time check is a single slice read. Per-doc metadata would require
  opening all docs to inspect.
- **No "start anyway in read-only mode" for outdated kernels.** Hard
  upgrade. Halfway compromises leak data-corruption risk. Users who
  can't update can disable sync first → offline mode.
- **Canvas-sync echo suppression via adapter-level `remoteApplying` flag.**
  Adapter wraps incoming delta application in a flag; skips those frames
  when reading `getFrameChanges`. Later, a proper `transact({origin})`
  API in reactive-ecs would be cleaner; library change not required for
  v1.
- **ECS kernel world: always eager materialization.** Plugin entity
  count stays ≤ ~100. Memory cost negligible. Reactive queries stay
  consistent.
- **"Match plugins across devices" mode: default off.** Safer default;
  first-run onboarding banner is non-blocking. Power-user opt-in for
  automatic matching.
- **Cascade-disable dependents when a service provider is uninstalled.**
  Silent cascade with user notification ("plugin-terminal disabled because
  plugin-mesh was uninstalled"). User can re-enable after installing a
  substitute.
- **Canvas-sync adapter: full-entity snapshot per widget.** Partial
  component-granular deltas deferred; widget configs are small, bandwidth
  isn't the bottleneck at current scale. Revisit if profiling demands.
