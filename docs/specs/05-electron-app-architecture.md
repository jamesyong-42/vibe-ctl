# 05 -- Electron App Architecture

> The Platform Layer deep-dive. Process topology, window model, preload
> surface, IPC transports, custom protocols, security model, renderer
> composition, split-plugin hosting, native integrations, packaging.
>
> Spec 02 §2 names what the platform owns; this spec fixes the *how*.

**Depends on:** `00-overview.md`, `01-plugin-system.md`, `02-kernel-runtime.md`, `03-monorepo-layout.md`
**Audience:** Shell implementors
**Status:** Draft v1

---

## 1. Scope

Owned here:

- Electron process topology (main, renderer, preload, utilityProcess, helper child_process)
- Window model (main window, detached widget windows, macOS dynamic-island window, tray)
- Preload script + `contextBridge` surface
- IPC transports between every pair of processes (main↔renderer, main↔utility, renderer↔utility, renderer↔renderer)
- Custom protocols (`host:`, `plugin:`) + file scheme policy
- Security model: Electron Fuses, sandbox, `contextIsolation`, CSP, navigation guards, permission handlers, ASAR integrity, hardened runtime, session partitioning
- Renderer composition (screens-first router, boot, providers, engine wiring)
- Split-plugin utilityProcess lifecycle + Comlink/MessagePort RPC
- Native integrations (tray, menu, traffic lights, macOS dynamic-island Swift helper, auto-updater, single-instance, deep-links)
- On-disk layout (`userData`, logs, cache, staging dir)
- Packaging (electron-builder, signing, notarization)
- Boot-time error screens (version gate, boot failure, update required)

Not owned here — cross-references only:

- Plugin contract (→ spec 01)
- Kernel state, sync fabric, ECS worlds, four kernel docs (→ spec 02)
- File tree, package boundaries (→ spec 03)
- Registry + marketplace (→ spec 04)

---

## 2. Process Topology

We adopt the **tri-process model** that has become 2026 standard practice
for Electron: a thin orchestrator Main, a heavy-lifting kernel
UtilityProcess, and a UI-only Renderer. Split plugins add their own
utility processes on top.

```
┌──────────────────────────────────────────────────────────────────┐
│ MAIN (Node, ESM, singleton) · The Orchestrator                    │
│   @vibe-ctl/shell/main                                            │
│   · app lifecycle, windows, tray, menu                            │
│   · OS integration (protocols, security, single-instance, DL)     │
│   · auto-updater                                                  │
│   · spawns the kernel utility + split-plugin utilities            │
│   · brokers MessagePorts between renderers and utilities          │
│   · near-zero business logic                                      │
└──────────────────────────────────────────────────────────────────┘
    │ MessagePortMain (ctrl + events)       │ ipcMain.handle
    ↓                                        ↕ contextBridge
┌──────────────────────────────────────────┐ ┌──────────────────────┐
│ UTILITY · Kernel (the Engine)             │ │ RENDERER · main win │
│ @vibe-ctl/runtime (network half)           │ │ (sandboxed,          │
│ · single NapiNode (truffle)               │ │  contextIsolated)    │
│ · network I/O, peer discovery, proxy      │◀┤ · React tree         │
│ · Loro snapshot persistence               │ │ · canvas engine      │
│ · authoritative kernel/* doc replicas     │ │ · in-memory kernel   │
│ · broadcasts CRDT deltas to renderer      │ │   ECS world (hot     │
│   over MessagePort                        │ │   path — 60fps)      │
│ · no DOM, no GL, no windows               │ │ · plugin renderer    │
└──────────────────────────────────────────┘ │   halves              │
    │ MessagePortMain (per-plugin)          │ └──────────────────────┘
    ↓                                        │       ↑ MessagePort per
┌──────────────────────────────────────────┐ │         split plugin (RPC)
│ UTILITY · split-plugin main               │ │       ↑ MessagePort per
│ one utilityProcess per split plugin        │◀┘         detached window
│ (claude-code, terminal, notifications)     │
│ · Node APIs, native modules                │ ┌──────────────────────┐
│ · Comlink over MessagePort                 │ │ RENDERER · detached  │
└──────────────────────────────────────────┘ │   widget windows      │
                                              │ RENDERER · dynamic    │
┌──────────────────────────────────────────┐ │   island (macOS only) │
│ CHILD · native helpers (child_process)    │ └──────────────────────┘
│ Swift NotchHelper, etc.                   │
│ owned by the plugin that spawns them      │
└──────────────────────────────────────────┘
```

### 2.1 The hybrid kernel split

The kernel isn't one thing — it's two concerns with very different
latency profiles:

| Concern | Hot path? | Lives in | Why |
|---|---|---|---|
| NapiNode (truffle network I/O, peer discovery, reverse proxy) | No — async, network-bound | **Kernel utility** | Native-code crash can't take the app down; main stays thin |
| Loro snapshot persistence | No — disk-bound | **Kernel utility** | Co-located with NapiNode which owns the socket the deltas arrive on |
| Authoritative `kernel/*` CRDT docs | Mixed | **Kernel utility** (authority) + **renderer** (replica) | Writes go utility→renderer as deltas; reads are local in renderer |
| Kernel ECS world (plugin entities, services, widget types) | Yes — queries fire at 60fps from canvas | **Renderer** | Cross-process queries per frame would annihilate latency |
| Canvas-sync adapter (spec 02 §4.2) | Yes — `onFrame` every tick | **Renderer** | Engine + adapter + local Loro replica must be co-located |
| Plugin host orchestration (discover, resolve, activate, disposables) | No | **Main** | Owns utility-process spawn + MessagePort brokering |

Rule of thumb: state replicates to wherever the consumer lives.
Authority — the "who persists this and gossips it to peers" role —
lives once, in the kernel utility.

### 2.2 Process responsibilities in one line each

| Process | Responsibility |
|---|---|
| **Main (orchestrator)** | OS integration, windows, protocols, security, port brokering, spawns kernel + plugin utilities. Near-zero business logic. |
| **Kernel utility (engine)** | NapiNode, truffle networking, Loro persistence, authoritative CRDT replicas. No DOM, no GL, no windows. |
| **Preload** | Inject `__vibeCtl` bridge + receive MessagePorts brokered by main |
| **Renderer (main window)** | Full app UI + canvas engine + in-renderer ECS + every plugin's renderer half + local Loro replicas |
| **Renderer (detached widget)** | Single reparented widget; same preload; restricted navigation; component-delta replica of the widget's entity |
| **Renderer (dynamic island, macOS)** | Notch widget; driven by `plugin-dynamic-island` |
| **Split-plugin utility** | One per split plugin; runs plugin's `main.js` with Node APIs |
| **child_process** | Native helpers (Swift binaries). Owned by the plugin that spawns them |

### 2.3 Why utilityProcess (not Node workers, not hidden BrowserWindows)

Electron's `utilityProcess` was purpose-built for this: full Node API,
proper lifecycle integration with `app.quit()`, crash isolation, no DOM
overhead, and first-class `MessagePortMain` support. Node worker threads
share the main process heap (a crash kills main). Hidden BrowserWindows
carry a full Chromium renderer for no reason. We use utilityProcess
everywhere except the macOS NotchHelper, which must be Swift because the
notch APIs are `private` and unavailable to Node.

---

## 3. Electron Fuses & Baseline Hardening

`app.enableSandbox()` runs before `app.whenReady()` (already in
`main/index.ts`). In addition we lock in the following Electron Fuses at
package time via `@electron/fuses`, flipping them off in
`electron-builder` afterPack hooks:

| Fuse | Setting | Reason |
|---|---|---|
| `RunAsNode` | **disabled** | Stops the packaged binary being re-used as a generic Node CLI |
| `EnableCookieEncryption` | **enabled** | Cookies at rest encrypted with OS keyring |
| `EnableNodeOptionsEnvironmentVariable` | **disabled** | `NODE_OPTIONS` can inject preload scripts |
| `EnableNodeCliInspectArguments` | **disabled** | `--inspect` on packaged build would expose a debug port |
| `EnableEmbeddedAsarIntegrityValidation` | **enabled** | ASAR tampering aborts launch (macOS + Windows) |
| `OnlyLoadAppFromAsar` | **enabled** | Refuses to load unpacked app directories |
| `LoadBrowserProcessSpecificV8Snapshot` | disabled | Not needed |
| `GrantFileProtocolExtraPrivileges` | **disabled** | Revokes legacy `file://` powers — we use `host:` / `plugin:` instead |

Additional baseline (see `src/main/security.ts`):

- `app.enableSandbox()` — every renderer + every utilityProcess sandboxed
- `contextIsolation: true` on every BrowserWindow
- `nodeIntegration: false`, `nodeIntegrationInWorker: false`, `webviewTag: false`
- `spellcheck: false` (no background download of dictionaries)
- macOS hardened runtime + notarization (see §12)
- Windows `signtool` EV signing
- Single-instance lock (`requestSingleInstanceLock`) — second-launch focuses existing window

---

## 4. Windows

### 4.1 Main window

One per user, created after `app.whenReady()` and `runtime.start()`
resolves. Opens at the primary display's `workArea` (Freeform aesthetic,
current behaviour). `backgroundColor` matches `--canvas-bg` in
`renderer/styles/index.css` so there's no paint seam at the rounded
corners. macOS uses `titleBarStyle: 'hiddenInset'` with custom
`trafficLightPosition`; win/linux get the default title bar.

`webPreferences` baseline (shared by *every* window we create):

```ts
const SECURE_WEB_PREFERENCES = {
  preload: PRELOAD_PATH,              // CJS, resolved from out/preload-cjs/
  sandbox: true,
  contextIsolation: true,
  nodeIntegration: false,
  nodeIntegrationInWorker: false,
  webviewTag: false,
  spellcheck: false,
  additionalArguments: [],            // Never forward CLI args
} as const;
```

Close behaviour:

- macOS: closing the main window hides it; `app.on('activate')` reopens.
  App stays in tray until `Cmd+Q` or tray → Quit.
- win/linux: closing the main window triggers `window-all-closed` which
  quits unless the user opted into "keep running in tray" (off by
  default; lives in user-settings).

### 4.2 Detached widget windows

A canvas widget can be popped out into its own frameless window
(multi-monitor workflow). Implemented by `detachWidget(widgetId)` in
`windows.ts`:

- Frameless, draggable via CSS `-webkit-app-region: drag` in a
  per-widget header strip (lives in `core/shell/src/renderer/chrome/`)
- Loads the renderer at route `/widget/{widgetId}` — the screen-router
  renders a single-widget shell that mounts that widget with
  `placement: 'detached'`
- Same preload, same CSP, same navigation guards
- On close: widget reattaches at its prior canvas position (the canvas
  CRDT entry is unchanged during detach; detach is a local UI mode)

Detached windows do **not** get their own engine instance. They observe
the main window's canvas ECS via a renderer-to-renderer `MessagePort`
(see §6.4). The canvas only exists once per app.

### 4.3 Dynamic-island window (macOS only)

Created by `@vibe-ctl/plugin-dynamic-island` via a kernel window request
(see §11). Frameless, transparent, non-activating, always-on-top, sized
to the notch. The plugin's utilityProcess spawns a Swift child_process
that positions the window via private APIs.

### 4.4 Tray

One tray icon, created in `main/tray.ts`. Menu: show/hide main window,
status (mesh peers online, pending approvals), quit. The tray-menu
counts come from kernel ECS queries proxied over IPC — not duplicated
state.

### 4.5 Deep links

`vibe-ctl://` protocol registered with the OS (macOS Info.plist,
Windows registry, Linux `.desktop`). Incoming URLs are routed through
the single-instance handler and dispatched to the kernel's command
registry (e.g. `vibe-ctl://install?repo=acme/x` → command
`plugins.installFromRepo`).

---

## 5. Preload & Context Bridge

One preload script, compiled to CJS. It runs in the isolated world of
every renderer we create (main window, detached widgets, dynamic
island).

**Why CJS, not ESM (the 2026 drift flag)**: the rest of the stack is
pure ESM (main, renderer, plugin bundles) and Vite HMR covers main +
renderer. Preload is the single exception: Electron's sandboxed preload
loader still cannot execute ESM modules, and we run every preload
under `sandbox: true`. This is tracked upstream and not yet fixed as of
Electron 41. Every production Electron app using sandbox has the same
constraint — spec 03 CLAUDE.md memo and `scripts/build-preload.mjs`
capture the workaround (esbuild-to-CJS companion build). When Electron
ships ESM preload under sandbox, we flip this in one line.

### 5.1 The `__vibeCtl` surface

```ts
// preload/index.ts
contextBridge.exposeInMainWorld('__vibeCtl', {
  platform: process.platform,

  // Synchronous request/response against main.
  // Every method name is in a closed enum on the main side; the
  // dispatcher rejects unknown names.
  invoke<M extends HostMethod>(method: M, payload: HostRequest<M>): Promise<HostResponse<M>>;

  // Receive a MessagePort from main for the event stream and
  // per-split-plugin RPC channels. Called once during renderer boot.
  onHostHandshake(cb: (event: { eventPort: MessagePort; pluginPorts: Record<string, MessagePort> }) => void): () => void;

  // Local log plumbing — forwards to main's Pino logger scoped to the
  // window id. Never swallows errors silently.
  log(level: 'debug'|'info'|'warn'|'error', scope: string, msg: string, meta?: unknown): void;
});
```

**Not exposed:**
- `ipcRenderer` directly — only `invoke()` by named method
- `require`, `process`, `Buffer`, `Electron` globals
- `process.versions` (fingerprinting surface; request via an audited IPC
  method if a plugin really needs it)
- `app.getPath()` outputs (exposed through `invoke('storage.getDataDir')`
  per plugin after a permission check)

### 5.2 Why `MessagePort`, not `ipcRenderer.on`

`ipcRenderer.on` is a broadcast bus: every listener in the renderer
receives every event. MessagePort is a private channel — the main
process hands out a separate port per plugin renderer half, and a
single kernel event port to the host renderer code. This gives us:

- **Isolation** — plugin A can't observe plugin B's RPC traffic through
  a stray `on('*')` listener
- **Ownership** — closing the port tears down that plugin's RPC
  cleanly; no orphaned listeners
- **Transferable** — ports can be re-handed to utilityProcesses without
  going through the main process as a proxy

The single `onHostHandshake` callback receives:
- `eventPort` — kernel → renderer pushed events (`plugin.activated`,
  `service.ready`, `mesh.peer.joined`, etc.)
- `pluginPorts[pluginId]` — Comlink port for that split plugin's
  utility half

### 5.3 TypeScript typing

`HostMethod`, `HostRequest<M>`, `HostResponse<M>` live in
`@vibe-ctl/runtime/src/ipc/contract.ts` and are consumed by the preload
build via `esbuild` (types erased, values don't cross). The renderer
imports the same types through a `type`-only barrel.

### 5.4 Relation to electron-trpc (prior art)

The dispatcher's shape — Zod-validated per-method schemas, a single
typed channel, typed client proxy in the renderer — is the same
pattern as [electron-trpc](https://github.com/jsonnull/electron-trpc).
We don't adopt electron-trpc itself because:

- Our host API is ~20 methods; tRPC's router/procedure abstraction
  buys ergonomics we don't need yet
- Push events go over a dedicated MessagePort (§6.2), not tRPC
  subscriptions — simpler, no polling fallback
- One fewer third-party dep on the kernel's critical path

If the method count passes ~50 or we want observable streams with
back-pressure, migrating to electron-trpc is a drop-in swap — the
Zod-per-method contract transfers directly.

---

## 6. IPC Transports

Five distinct channels, each with a specific job. Never mix them.

### 6.1 Renderer → Main: request/response (`invoke`)

Used for any call with a return value: listing plugins, enabling a
plugin, reading a setting, requesting a detach, starting the updater.

- Transport: `ipcRenderer.invoke(channel, payload)` on one fixed
  channel name `'vibe-ctl:host'`. Payload is `{ method, args }`.
- Dispatcher: single `ipcMain.handle('vibe-ctl:host', …)` in
  `@vibe-ctl/runtime/src/ipc/host-dispatcher.ts`. Looks up `method`
  in a frozen `Record<HostMethod, Handler>`. Unknown method → throw
  `MethodNotFound`; the renderer sees a rejected promise.
- Timeouts: per-method, enforced main-side. No method may block >5s
  without emitting progress on the event port.
- Validation: every method declares a Zod schema for its args. The
  dispatcher validates before calling the handler.

### 6.2 Main → Renderer: kernel event stream (MessagePort)

Used for push: plugin lifecycle events, sync peer events, service
readiness, permission prompt requests, canvas CRDT deltas the renderer
must paint.

- Transport: a `MessageChannelMain` pair; one end kept on main, the
  other transferred to the renderer once per window load via
  `webContents.postMessage('vibe-ctl:handshake', payload, [eventPort])`.
- Messages: `{ type: keyof VibeEvents, payload }`. The renderer side
  fans these out into React via a single `useEventStream()` hook
  backed by Zustand.
- Backpressure: main buffers up to 1024 events if the renderer hasn't
  drained; beyond that, oldest dropped with a single warning log. In
  practice the queue stays near-empty because React batches on the
  consumer side.

### 6.3 Renderer ↔ UtilityProcess: per-plugin RPC (Comlink/MessagePort)

Used by `ctx.rpc` in split plugins.

- Transport: a dedicated `MessageChannelMain` per split plugin, created
  when the utilityProcess is spawned. One end goes to the
  utilityProcess via `utility.postMessage(msg, [port])`; the other goes
  to the renderer through the handshake payload.
- Protocol: Comlink. Plugin author writes
  `ctx.rpc!.expose(impl)` on one half, `ctx.rpc!.connect<I>()` on the
  other; the kernel never inspects the payloads.
- Lifecycle: ports close when either half deactivates. Comlink's
  auto-release via `FinalizationRegistry` handles forgotten proxies.

### 6.4 Main ↔ Kernel utility: ctrl channel + event fanout (MessagePort)

Used for kernel-utility lifecycle (start, stop, health) and for the
authoritative-replica protocol that keeps in-renderer Loro copies in
sync with the kernel utility's authoritative copy.

- **Ctrl port**: main ↔ kernel utility. RPC-style (Comlink). Main
  calls `kernel.start()`, `kernel.stop()`, `kernel.getPeers()`,
  `kernel.healthCheck()`. Small surface.
- **Doc-sync port per renderer**: the kernel utility holds the
  authoritative Loro doc; each renderer (main window, detached, dynamic
  island) opens a MessagePort to the kernel utility that carries Loro
  binary deltas in both directions.
  - Renderer → utility: local edit deltas the renderer originated
    (e.g. user dragged a widget → canvas-sync adapter emits a delta).
    Utility merges into the authority copy, persists, and gossips to
    peers via truffle.
  - Utility → renderer: remote deltas received from peers (and rebroadcast
    local deltas that arrived from other renderers via the fan-out).
    Renderer merges into its local replica; reactive-ecs queries fire.
  - The port is **brokered by main**: main creates a
    `MessageChannelMain`, ships one end to the utility and the other
    into the renderer's handshake payload. Main never inspects
    messages after brokering.

This is the only sync-fabric traffic that crosses a process boundary.
Everything downstream of the renderer-local Loro replica (ECS, React
queries, widgets) stays in-process and runs at 60fps.

### 6.5 Renderer ↔ Renderer: detached-widget bridge (MessagePort)

Used when a widget is detached: the detached window needs to observe
the same canvas ECS state as the main window but can't own the engine.

- Transport: when `windows.detachWidget(id)` runs, main mints a new
  `MessageChannelMain`, transfers one end to each renderer through its
  handshake payload, and also records the pairing in kernel ECS.
- Content: a small reactive-ecs delta replication protocol — the main
  window broadcasts component changes for the widget's entity; the
  detached window replays them into a local single-entity ECS to drive
  its React tree. Widget code is unaware this is happening.

### 6.6 What we explicitly do not do

- **No `remote` module.** Removed from Electron years ago anyway; flag
  it if it reappears via a stray dep.
- **No shared `SharedArrayBuffer` with renderer-untrusted plugins.**
  Kernel uses SABs internally for canvas frames but never exposes them
  through `ctx.*`.
- **No HTTP server on `localhost` for IPC.** The PWA bridge (spec 04 +
  outdated/09) is HTTP, but kernel↔renderer is always MessagePort.
- **No `contextBridge.exposeIsolatedWorldIsolate` acrobatics.** One
  isolated world per window, one bridge. Simple > clever.

---

## 7. Custom Protocols

Three schemes. Registered once, before `app.whenReady()`.

```ts
protocol.registerSchemesAsPrivileged([
  { scheme: 'host',   privileges: { standard: true, secure: true, supportFetchAPI: true, corsEnabled: false, stream: true } },
  { scheme: 'plugin', privileges: { standard: true, secure: true, supportFetchAPI: true, corsEnabled: false, stream: true } },
  // file: is NOT re-privileged — GrantFileProtocolExtraPrivileges fuse is OFF
]);
```

### 7.1 `host:` — shell-owned assets

Backs the renderer's own HTML/JS/CSS/images in packaged builds (dev
uses the Vite dev server). `host:/index.html`, `host:/assets/…`,
`host:/icons/back.svg`. Served from `app.getAppPath()` inside the ASAR,
stream-friendly for large R3F assets. CSP treats this as `'self'`.

### 7.2 `plugin:` — plugin-contributed assets

Path shape: `plugin://{pluginId}/{pathRelativeToPluginDist}`. The
handler:

1. Extract `pluginId` from the URL hostname
2. Ask the plugin host for the on-disk dir for that plugin
3. `path.resolve` the requested asset
4. **Reject if the resolved path escapes the plugin dir** (path-traversal guard)
5. Stream the file with the right `Content-Type`

Plugins never write to `plugin:` — it's read-only. Writable per-plugin
storage goes through `ctx.storage.*` which resolves to a per-plugin
subdir under `userData` (§10).

### 7.3 `file:` policy

Revoked via the `GrantFileProtocolExtraPrivileges` fuse. The renderer
cannot load file URLs directly. `loadFile()` in main still works for
the initial renderer HTML in builds that don't use `host:` yet, but
every navigation after the initial load is intercepted by the
navigation guard (§8.3).

---

## 8. Security Model

Concerns are layered in depth. Each layer assumes the one above it could
fail.

### 8.1 CSP

Emitted as an HTTP response header from `session.defaultSession` (see
`main/security.ts`). Takes precedence over any `<meta http-equiv>` in
`index.html`.

- **Production:** `default-src 'self'; script-src 'self'; style-src
  'self' 'unsafe-inline'; img-src 'self' data: blob: host: plugin:;
  font-src 'self' data:; connect-src 'self'; worker-src 'self' blob:;
  object-src 'none'; base-uri 'self'; form-action 'self';
  frame-ancestors 'none';`
- **Dev:** same, plus `'unsafe-inline' 'unsafe-eval' <devUrl>` on
  `script-src` and `<devUrl> <wsUrl>` on `connect-src` — narrow
  carveouts for Vite HMR. Gated by `ELECTRON_RENDERER_URL` being set.

`style-src 'unsafe-inline'` is load-bearing for Tailwind v4's runtime
style injection and inline React style props. Removing it breaks the
app. We accept the tradeoff.

### 8.2 Permission handlers

`session.defaultSession.setPermissionRequestHandler` + `setPermissionCheckHandler`
deny everything except a small allowlist (currently `notifications`,
`clipboard-sanitized-write`). Every other Chromium permission — camera,
mic, geolocation, persistent-storage, midi, HID, serial, USB, Bluetooth
— is denied.

Plugin permissions (defined in spec 01 §9) are **separate** from these
Chromium-level permissions. Plugin permissions go through
`ctx.permissions.require(…)` which prompts the user via a kernel-owned
modal (never the Chromium prompt).

### 8.3 Navigation guards

Per-window, installed in `guardNavigation()`:

- `will-navigate` → block any URL not matching dev origin, `host:`,
  `plugin:`, or the packaged `file:` HTML entry. External URLs open in
  the OS browser via `shell.openExternal`.
- `will-attach-webview` → denied outright. No `<webview>` ever.
- `setWindowOpenHandler` → always `{ action: 'deny' }`; external URLs
  forwarded to OS browser; in-app popups forbidden.

### 8.4 Session partitioning

We use the **default** session for the main window, and a **named
ephemeral session** (`persist:ephemeral-{uuid}`) for each detached
widget window — no persistent storage, no service workers, no cookies.
This guarantees that a hostile cross-origin navigation that slips past
the guard (defense-in-depth) can't drop anything that survives a close.

Plugins that legitimately need persistent storage go through
`ctx.storage`, which is main-side file I/O, not browser storage.

### 8.5 ASAR integrity

`EnableEmbeddedAsarIntegrityValidation` + `OnlyLoadAppFromAsar` fuses.
The packaged ASAR's SHA-256 is embedded in the main binary at
packaging time; any post-install tamper aborts launch.

### 8.6 Code signing & notarization

- **macOS:** hardened runtime, `Developer ID Application` signing,
  Apple notarization, stapled ticket. Entitlements: only
  `com.apple.security.cs.allow-jit` and
  `com.apple.security.cs.allow-unsigned-executable-memory` (needed by
  V8). No broader filesystem entitlement.
- **Windows:** EV cert, `signtool` with timestamping. SmartScreen
  reputation earned over versions.
- **Linux:** AppImage + .deb + .rpm. No signing story available;
  distribute SHA-256 + GPG-signed manifest from the release page.

### 8.7 Plugin-supplied code

Plugin tier (T1/T2/T3) is determined by install source, never from
manifest (spec 02 §9). Additional runtime constraints:

- **T3 plugins run without Node APIs in the renderer.** Renderer halves
  are plain JS modules executed in the sandboxed renderer; no
  `require` available.
- **T3 main halves run in a utilityProcess with `--experimental-permission`
  enabled** (Node 22+). Capability allow-list limited to
  `fs.read/write` under the plugin's `dataDir`, `net` for mesh
  traffic, and `child_process` denied unless the `native-helper`
  permission is granted.
- **T2 plugins** bypass the Node permission model (signed + reviewed).
- **T1 plugins** bypass everything (we wrote them).

---

## 9. Renderer Composition

Screens-first, already scaffolded in
`core/shell/src/renderer/` (spec 03 §3). This section adds the *rules*.

### 9.1 Bootstrap order

```
entry.client.tsx
  └─ import './styles/index.css'
  └─ <React.StrictMode>
       <Providers>                   // stacks every cross-screen provider
         <Root />                    // reads screen state, picks screen
       </Providers>
     </React.StrictMode>

Providers (outer → inner):
  1. LogProvider                     // attaches window.onerror/unhandledrejection
  2. HostBridgeProvider              // waits for onHostHandshake, exposes ports
  3. EventStreamProvider             // subscribes to eventPort, feeds Zustand
  4. ThemeProvider                   // reads kernel/user-settings, paints <html>
  5. I18nProvider                    // (deferred: single-locale v1)
  6. ScreenStateProvider             // owns the screen-router state machine
```

No provider may reach across to the renderer DOM before
`HostBridgeProvider` has completed the handshake. Renderers without a
host bridge (e.g. tests) pass a `mockBridge` explicitly.

### 9.2 Screen state machine

Deterministic, one-way flow driven by `useScreenState`:

```
          boot()
            ↓
        ┌───────┐  ready   ┌──────────────┐  outdated?  ┌──────────────┐
        │ boot  │────────▶ │ version-gate │────────────▶│ version-gate │  (blocking)
        └───────┘          └──────────────┘             └──────────────┘
            │                      │ ok
            │ fatal error          ↓
            ↓              ┌──────────────┐  first-run?  ┌──────────────┐
        ┌───────┐          │   loading    │──────────────▶│  onboarding  │
        │ error │          └──────────────┘              └──────────────┘
        └───────┘                 │ done              done ↓
                                  ↓                  ┌──────┐
                                  ┌─────────────────▶│ main │
                                                     └──────┘
```

- `boot`: runtime handshake in flight. Plain spinner on canvas bg.
- `loading`: runtime activated; plugins activating. Shows progress.
- `onboarding`: first-run (`kernel/user-settings` missing
  `onboarding.completedAt`). Stepper shell; steps live in
  `screens/onboarding/steps/`.
- `version-gate`: shell kernel version < any peer's `minKernelVersion`.
  Blocking. Only action is "Check for updates" → auto-updater.
- `main`: the canvas experience. Three layers + overlays.
- `error`: unrecoverable boot failure. Shows the error, the log-file
  path, and a "Reset app" escape hatch that rotates `userData` to
  `userData.broken-{timestamp}` and relaunches.

Screens never skip states. Transitions are driven by events on the
event port or explicit user actions — never by `setTimeout` polling.

### 9.3 The `main` screen's three layers

| Layer | z | Input | Pointer events |
|---|---|---|---|
| `workspace` | 0 | Canvas engine; pan/zoom, widgets | Always |
| `hud` | 10 | React DOM overlay; nav bar, dock, panels | Only on its own elements (CSS `pointer-events: none` on container, `auto` on children) |
| `dynamic-island` | 20 (own window on mac) | macOS notch widget | Always inside its bounds |
| `overlays` | 30 | Full-screen React surfaces from dock (agents monitor, command palette, etc.) | When open |

HUD never forwards pointer events to workspace — the workspace handles
its own pan/zoom via infinite-canvas's event capture. This prevents the
classic "drag a button and pan the canvas by accident" bug.

### 9.4 Engine lifecycle

Exactly one canvas engine per app, constructed by `EngineProvider`
inside `screens/main/workspace/` — deliberately *inside* the `main`
screen, not at the providers root. Reasons:

1. The engine allocates WebGL contexts; we don't want them live during
   `loading` / `onboarding`.
2. Switching to `version-gate` or `error` tears down the engine.
3. The engine's canvas ECS adapter is wired to the kernel's
   `kernel/canvas-layout` CRDT only once the runtime is active.

On leaving `main`, the engine disposes. On re-entering, a fresh engine
subscribes to the same CRDT; the layout rehydrates identically.

**Renderer backend**: WebGL by default in v1 (broadest compatibility;
xterm-r3f and r3f-msdf are both WebGL-first today). WebGPU is the 2026
direction and Chromium in Electron 41 ships it unflagged, but the
decision belongs to `@jamesyong42/infinite-canvas` which we develop in
parallel — the shell defers to whatever backend the engine exposes.
When infinite-canvas adds a WebGPU path, a user-facing toggle in
Settings flips it per-device.

### 9.5 Plugin renderer halves

Every plugin's renderer half is loaded as an ES module by the kernel's
plugin-host via a dynamic `import(plugin:{id}/renderer.js)`. The module
exports a default `Plugin` subclass; the host instantiates it, injects
`ctx`, and calls `onActivate()`. Plugins register widgets via
`ctx.widgets.register`, which mirrors to the kernel ECS; the screen
layer queries the registry to render contributed placements.

No plugin code runs outside the `main` screen. During `loading`,
plugins are activating but their widgets are not yet mounted. This is
load-bearing: a plugin crash during activation must not poison earlier
screens.

### 9.6 Chrome (Electron-specific renderer code)

Lives under `core/shell/src/renderer/chrome/`. Anything using
`-webkit-app-region`, `window.__vibeCtl.*`, or platform-specific layout
(macOS traffic-light inset, Windows title-bar overlay) stays here.
Future `core/web-shell/` would have its own equivalent. Nothing in
`core/ui` or any plugin may touch these APIs.

---

## 10. Split-Plugin Utility Host

Implemented in `core/shell/src/main/utility-process-host.ts` +
`core/runtime/src/plugin-host/activation.ts`.

### 10.1 Spawn

```ts
const child = utilityProcess.fork(entryPath, [], {
  serviceName: `vibe-ctl-plugin-${pluginId}`,
  stdio: 'pipe',                      // main collects logs with plugin scope
  env: {
    ...process.env,
    VIBE_PLUGIN_ID: pluginId,
    VIBE_PLUGIN_DATA_DIR: dataDir,
    NODE_OPTIONS: '',                 // fuse disables this, but belt & braces
  },
});
```

`stdio: 'pipe'` routes the child's stdout/stderr through main's Pino
logger with a `plugin:{id}` scope. Plugin authors' `console.log` ends
up in the kernel log, not the terminal.

### 10.2 Handshake

Immediately after spawn, main mints three `MessageChannelMain`s:

1. **ctx port** — kernel ↔ plugin's utility half, for the `PluginContext`
   proxy (Comlink)
2. **rpc port** — renderer ↔ utility half, for `ctx.rpc.expose/connect`
3. **event port** — kernel → utility half push events

Ports are delivered in a single handshake message. The utility side
wires Comlink and calls `Plugin.onActivate()` once it receives
`ctx.ready = true`.

### 10.3 Crash recovery

Per spec 01 Decisions. Implementation:

- `child.on('exit', …)` → if exit wasn't user-initiated, schedule
  restart with backoff `[1s, 4s, 16s]`. Beyond 3 restarts, mark plugin
  `Failed` in kernel ECS; user must re-enable.
- On restart, widgets contributed by the plugin *stay mounted* showing a
  reconnecting state (not unmounted → no React tree churn). When the
  utility half reattaches, Comlink resubscribes and widgets resume.
- Kernel logs the last 1KB of child stderr at `error` level with the
  plugin id; full stderr persisted to `{userData}/logs/plugins/{id}.log`
  with rotation.

### 10.4 Graceful shutdown

`before-quit`:
1. Kernel sends `deactivate` to each utility (in reverse topo order).
2. 5s timeout per plugin.
3. `child.kill('SIGTERM')`; 2s later `SIGKILL` if still alive.
4. `utilityProcess.on('exit')` resolves the deactivation promise.

The main process waits for all deactivations before calling `app.exit`.
A single plugin hanging does not block quit past ~20s worst case.

---

## 11. Native Helpers

Owned by plugins, not by the kernel. The kernel exposes `ctx.process.spawnHelper()`
(new; add to plugin-api in a future minor release) which:

- Verifies the plugin has the `native-helper` permission
- Resolves the helper binary path relative to the plugin's dist dir
- Validates the binary's code signature on macOS/Windows (plugin's
  manifest declares its Team ID / subject)
- Spawns via `child_process.spawn` with `detached: false`, `stdio:
  'pipe'`
- Wires stdout/stderr to the plugin's Pino scope
- Returns a `HelperHandle` (Disposable) tracked in `ctx.track()`

Rationale: the dynamic-island Swift binary is plugin-specific; making
it a kernel concern would leak macOS specifics into the kernel. The
kernel's responsibility is *spawning safely*, not *knowing what's
being spawned*.

---

## 12. On-Disk Layout

```
~/Library/Application Support/vibe-ctl/                (macOS; Linux/Win analogous)
├── Preferences                      # Electron's built-in (window bounds, zoom)
├── config/
│   └── device-identity.json         # Stable deviceId generated on first run
├── plugins/                         # User-installed plugins (T2/T3)
│   └── {pluginId}/                  # Dist artifacts; read via plugin: protocol
├── plugin-data/                     # Per-plugin writable storage
│   └── {pluginId}/                  # ctx.storage.* resolves here
├── logs/
│   ├── main.log                     # Pino, rotated daily, 7-day retention
│   └── plugins/
│       └── {pluginId}.log           # Separate stream per split plugin
├── install-staging/                 # Transient; download target for installs
│   └── {pluginId}/
├── backups/                         # Pre-update plugin snapshots, 30d
│   └── {pluginId}/{version}/
├── truffle/                         # Truffle NapiNode state + Loro snapshots
│   └── (internal; managed by @vibecook/truffle)
└── cache/                           # Chromium cache; safe to delete
```

`app.setPath('sessionData', …)` points Chromium's session storage at a
subdir we control so wiping `cache/` doesn't nuke unrelated state.

---

## 13. Packaging & Distribution

### 13.1 Build pipeline

```
pnpm build            (turbo: core/* then plugins/*)
pnpm bundle-plugins   (copies plugins/*/dist → apps/desktop/resources/plugins/)
pnpm package          (electron-builder for current OS)
```

### 13.2 electron-builder config

- `asar: true`, `asarUnpack` only for the Swift NotchHelper (must live on
  real filesystem for macOS to exec it) and any `.node` native modules
- `extraResources`: `apps/desktop/resources/**` (plugins + icons)
- `afterPack`: flip Electron Fuses (§3)
- `afterSign`: Apple notarization via `electron-notarize`
- `publish`: GitHub Releases (`apps/desktop/release/`); `latest.yml` /
  `latest-mac.yml` consumed by `electron-updater`
- `mac.hardenedRuntime: true`, `mac.gatekeeperAssess: false`,
  `mac.entitlements: build/entitlements.mac.plist`
- Separate universal (`x64 + arm64`) and arch-specific builds; the CI
  matrix decides which to publish

### 13.3 Auto-updater

`electron-updater`. Checks on launch + every 6 hours. Downloads in the
background; prompts on next idle. User can defer.

Staged rollout: `latest.yml` is generated with a `stagingPercentage`
field; updater skips if `Math.random() * 100 > stagingPercentage`.
Bumped to 100 after a 24-hour smoke period.

### 13.4 Version compat with plugins

App version and `apiVersion` are **independent**.

- `kernelVersion` — the Electron app version; authoritative across mesh
  peers (spec 02 §4.1)
- `apiVersion` (in `plugin.json`) — the plugin-api semver the plugin
  was built against

A new app release bumps both only when the plugin contract actually
changed. Most app updates only bump `kernelVersion`.

---

## 14. Invariants

1. Exactly one main process; `requestSingleInstanceLock()` enforces.
2. Exactly one preload file per window; always CJS; always from
   `out/preload-cjs/`.
3. Every BrowserWindow we construct uses `SECURE_WEB_PREFERENCES`.
   There is no code path that creates a BrowserWindow without it.
4. Custom protocols are registered before `app.whenReady()`; after
   ready, `protocol.handle` only refines handlers.
5. The CSP header wins over any `<meta>` tag; security.ts is the sole
   source of the CSP string.
6. Navigation guards run on every window; detached windows inherit.
7. No plugin code runs in the main process. Plugin main halves run in
   a utilityProcess. (Exception: T1 plugins *could* run in main, but
   by convention don't, so the monitoring story stays uniform.)
8. Renderer never receives `ipcRenderer` directly. Every host call
   goes through `invoke(method, …)` which validates against a closed
   enum.
9. Split-plugin utility processes never open BrowserWindows. If a
   plugin needs a window, it registers a widget with `placement:
   'detached'` and lets the kernel manage the window.
10. `file:` protocol has no extra privileges (fuse off). Renderer asset
    loads go through `host:` in production.
11. macOS dynamic island runs in its own frameless window with
    `visibleOnAllWorkspaces: true`, `focusable: false`. It never
    becomes the key window and never captures keyboard input.

---

## 15. Open Questions

Unresolved; tracked here so they don't get lost.

- **Renderer isolation for T3 plugins in the main window.** Today all
  renderer halves share one renderer process + one React tree. A
  misbehaving T3 plugin can crash the whole renderer. Options: (a)
  accept and rely on utility-half isolation for the dangerous bits; (b)
  render T3 widgets inside an `<iframe>` with its own CSP; (c) one
  BrowserWindow per T3 plugin, composited with `BrowserView`-style
  layering. Default v1 stance: (a) — revisit when there's user pressure.

- **Dynamic island on non-macOS.** Windows 11 has a small "system tray
  badge" story; Linux has nothing analogous. Likely: `plugin-dynamic-island`
  is mac-only (manifest `engines.platform: ['darwin']`); other
  platforms get a taskbar-icon variant that's a different plugin.

- **GPU process crashes.** Chromium auto-respawns the GPU process.
  We should listen for `gpu-process-crashed` and, after N occurrences
  in M minutes, fall back to `--disable-gpu` with a user-visible
  warning. Not v1.

- **Swap `host:` for `file:` fallback?** Early versions can keep using
  `file://` for packaged HTML to avoid writing a real protocol handler
  until the plugin marketplace ships. Cost: `GrantFileProtocolExtraPrivileges`
  fuse stays disabled either way; the file: load must be an initial
  navigation only, which the guard already enforces.

- **V8 snapshots for cold-start.** 2026 advanced-team pattern: serialize
  the initialized JS heap at build time, deserialize instantly at
  launch. Typically shaves 200–500ms. Our current cold-start is
  dominated by NapiNode init (native, not JS) and plugin activation
  (kernel work, not JS parse), so expected gain is smaller. Defer
  until we have real boot-time traces; revisit with
  `electron-builder`'s snapshot integration and see
  `v8-compile-cache` as a less-invasive intermediate step.

- **WebGPU timeline.** Deferred to infinite-canvas (same author, parallel
  development). Shell commits to a swappable renderer surface but no
  WebGPU-specific code until the engine exposes the option.

- **Full kernel separation.** Hybrid (§2.1) keeps in-renderer ECS for
  the canvas hot path. If plugin-host orchestration grows heavy enough
  to jank the renderer, move the ECS world into the kernel utility
  and pay the IPC cost for canvas writes via batched delta flushes
  rather than per-frame round-trips. Not v1.

---

## Decisions

- **Tri-process topology with hybrid kernel split.** Main = orchestrator
  only; Kernel UtilityProcess owns NapiNode + Loro authority + disk
  persistence; Renderer owns the kernel ECS world + local Loro replicas
  + canvas hot path. A native (NAPI) crash can no longer take the app
  down, and main stays thin, but canvas queries at 60fps remain
  in-process. Non-negotiable trade: authority lives once in the kernel
  utility and replicates to wherever consumers need it.

- **Local-first persistence = Loro snapshots only, v1.** No SQLite.
  Kernel utility persists Loro binary snapshots on the truffle schedule;
  plugin `ctx.storage` stays as a simple file-backed key/value under
  `plugin-data/{pluginId}/`. When a plugin needs real indexed query
  (FTS5, joins, aggregates), revisit `node:sqlite` as an opt-in
  `ctx.storage.sqlite()` primitive — but not until the use case is
  concrete. Keeping one persistence primitive keeps the contract small.

- **utilityProcess, not Node workers, for split plugins.** Crash
  isolation from main, full Node API, proper quit integration. Worker
  threads share heap with main — a plugin bug kills the app.

- **One preload, one `__vibeCtl` bridge.** Per-plugin preloads would
  explode the attack surface and fragment the contract. Plugins reach
  host capabilities exclusively through `ctx.*`, which is backed by
  `invoke(…)` under the hood.

- **MessagePort for event streams, not `ipcRenderer.on`.** Private
  channel semantics, transferable, clean teardown on window close.
  `ipcRenderer.on` is a broadcast bus with no ownership story.

- **`host:` + `plugin:` protocols, file: demoted.** Custom schemes give
  per-origin CSP boundaries and a path-traversal-safe resolver for
  plugin assets. `GrantFileProtocolExtraPrivileges` fuse off means
  renderer can't smuggle in local files via `file://` even if the
  guard is bypassed.

- **Detached widgets share the main renderer's engine via
  renderer-to-renderer MessagePort.** One canvas engine per app is
  load-bearing for the canvas-sync adapter and WebGL context count.
  Replicating component deltas over a MessagePort is cheap; widget
  authors never know.

- **Swift NotchHelper lives under the dynamic-island plugin, not the
  shell.** Keeps the kernel platform-agnostic; `ctx.process.spawnHelper`
  is the only kernel-side contract.

- **Electron Fuses locked at packaging, via `@electron/fuses` in
  `afterPack`.** Runtime-side `app.enableSandbox()` is redundant with
  `RunAsNode: false` but we keep it — defense in depth costs nothing.

- **Sandbox + contextIsolation everywhere, no opt-out.** Any window
  not using `SECURE_WEB_PREFERENCES` is a bug, not a feature.

- **`style-src 'unsafe-inline'` accepted.** Tailwind v4 + React inline
  styles require it. Script side stays strict (no `'unsafe-inline'`
  outside dev-mode HMR carveouts).

- **Per-plugin ephemeral sessions for detached widgets.** No persistent
  storage leak if a compromised plugin escapes its sandbox in a
  detached window.

- **Error screen before crash report.** A boot failure lands on the
  renderer `error` screen with the log path visible. We do not ship
  a crash-reporter-to-cloud in v1; Sentry-equivalent can be added as a
  first-party plugin later, with explicit user opt-in.

- **Single-instance lock lives at main entry, synchronous.** Before
  any window can exist. Second launch focuses the existing window and
  forwards any `vibe-ctl://` deep-link via `second-instance` event.
