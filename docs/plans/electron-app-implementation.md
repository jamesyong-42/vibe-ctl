# Electron App Implementation Plan

Ordered, commit-sized phases to build the Electron shell + kernel runtime
per `specs/05-electron-app-architecture.md` (with specs 00-04 as the
broader contract). Each phase ends at a state where the tree builds,
typechecks, and lints clean.

**Principles:**
- Each commit is small and buildable on its own.
- Security-critical plumbing (preload, CSP, fuses, protocols) lands
  before any surface area that could exploit a gap.
- The tri-process skeleton is wired end-to-end before we add features —
  we'd rather have a handshake carrying nothing than real code with no
  handshake.
- Plugin API surface follows the kernel, not the other way round — we
  only widen `PluginContext` when the kernel can actually back it.
- Each phase names a **verification step** — the check that must pass
  before moving on.

Scope boundary: this plan gets us to a working shell hosting one
first-party plugin end-to-end (spec 02 §6 walkthrough). Further plugins
(terminal, notifications, dynamic-island, etc.) follow the same
template established in Phase 9 and are out of this plan's scope.

---

## Phase 0 — Foundations

**Goal:** fix the ground rules — shared tsconfigs, new deps, IPC
contract types — so every subsequent commit has a stable spine.

**Verification:** `pnpm install && pnpm typecheck && pnpm build` green
on the untouched packages; `core/runtime` exports the new `ipc/` barrel.

### Commits

1. `chore(tooling): electron-utility + electron-preload tsconfig presets`
   - `tooling/tsconfig/electron-utility.json` (Node 24, ESM, no DOM)
   - `tooling/tsconfig/electron-preload.json` (Node 24, CJS, DOM types)
   - Export from `tooling/tsconfig/package.json`
2. `chore(deps): add comlink, pino, @electron/fuses, electron-notarize`
   - Hoist to root where shared; place in `core/runtime` and
     `core/shell` specifically where used.
3. `feat(runtime): IPC contract types (HostMethod enum, request/response)`
   - `core/runtime/src/ipc/contract.ts`
   - `core/runtime/src/ipc/events.ts` (VibeEvents port message shapes)
   - `core/runtime/src/ipc/kernel-ctrl.ts` (main ↔ kernel Comlink interface)
   - `core/runtime/src/ipc/doc-sync.ts` (kernel ↔ renderer delta protocol)
   - `core/runtime/src/ipc/handshake.ts` (port handshake payload)
4. `feat(runtime): Zod schemas per host method`
   - `core/runtime/src/ipc/schemas/{plugins,settings,windows,updater,permissions,system}.ts`
   - Barrel in `core/runtime/src/ipc/schemas/index.ts`
5. `feat(runtime): structured logger (pino)`
   - `core/runtime/src/logging/logger.ts` (root logger, scope child factory)
6. `chore(runtime): tsup two-entry config — lib + kernel-utility`
   - `core/runtime/tsup.config.ts` emits `dist/index.js` and
     `dist/kernel-utility.js`. The latter is the utility process entry
     (runs inside `utilityProcess.fork`).

---

## Phase 1 — Tri-process skeleton (empty handshake end-to-end)

**Goal:** wire the three processes together with MessagePorts carrying
no payload. Prove the topology works before adding features.

**Verification:** `pnpm dev` opens the main window; a noop
`invoke('system.ping')` roundtrips to main and back; event-port
handshake logs on both sides; a stub kernel utility spawns and the ctrl
Comlink `getVersion()` returns a value.

### Commits

1. `feat(runtime): Runtime class skeleton`
   - `core/runtime/src/main-api/Runtime.ts` with empty `start()/stop()`
   - `core/runtime/src/main-api/options.ts` (RuntimeOptions type)
   - `core/runtime/src/index.ts` exports `Runtime`, contract types,
     schemas.
2. `feat(runtime): kernel utility entry + ctrl service stub`
   - `core/runtime/src/kernel-utility/entry.ts` — parentPort handshake
   - `core/runtime/src/kernel-utility/ctrl-service.ts` — Comlink exposes
     `{ getVersion, getPeers: () => [], health: () => 'ok' }` stubs
   - `core/runtime/src/kernel-utility/shutdown.ts`
3. `feat(shell): split main/index.ts into app/* modules`
   - `src/main/app/{single-instance,lifecycle,fuse-check,deep-links}.ts`
   - `src/main/index.ts` becomes a composition root only
4. `feat(shell): kernel spawn + supervisor (no restart policy yet)`
   - `src/main/kernel/spawn.ts` — `utilityProcess.fork(dist/kernel-utility.js)`
   - `src/main/kernel/ctrl-client.ts` — Comlink proxy
   - `src/main/kernel/supervisor.ts` — stub (restart logic lands Phase 3)
5. `feat(shell): IPC broker + handshake plumbing`
   - `src/main/ipc/broker.ts` — creates MessageChannelMain pairs on demand
   - `src/main/ipc/handshake.ts` — `webContents.postMessage('vibe-ctl:handshake', …)`
   - `src/main/ipc/host-dispatcher.ts` — `ipcMain.handle('vibe-ctl:host')` with empty method map
6. `feat(shell): windows/web-preferences + factory split`
   - `src/main/windows/web-preferences.ts` — single SECURE_WEB_PREFERENCES const
   - `src/main/windows/main-window.ts` — extracts main-window factory
   - `src/main/windows/manager.ts` — rewritten over the factories
7. `feat(shell): preload — bridge + invoke + handshake receiver`
   - `src/preload/bridge.ts` — `contextBridge.exposeInMainWorld('__vibeCtl', …)`
   - `src/preload/invoke.ts` — typed invoke wrapper
   - `src/preload/handshake.ts` — listens on `webContents` message event,
     dispatches ports to the renderer window
   - `src/preload/log.ts` — forwarder to main's pino
8. `feat(renderer): HostBridgeProvider + EventStreamProvider`
   - `src/renderer/host/HostBridgeProvider.tsx` — awaits handshake
   - `src/renderer/host/useHostInvoke.ts`
   - `src/renderer/host/EventStreamProvider.tsx` — MessagePort → Zustand
   - `src/renderer/host/useEventStream.ts`
   - `src/renderer/app/providers.tsx` — stack them outside the theme provider
9. `feat(renderer): BootScreen while handshake in flight`
   - `src/renderer/screens/boot/BootScreen.tsx`
   - Wire into `screen-router` as the initial state
10. `feat(runtime): wire Runtime.start() to spawn kernel utility`
    - `Runtime.start()` calls into `shell`-provided callbacks that own
      the spawn; runtime itself stays Electron-agnostic except for
      kernel-utility entry path resolution.

---

## Phase 2 — Security hardening

**Goal:** close the door before growing the feature surface. All
defense-in-depth layers in place; dev and prod CSPs behave.

**Verification:** production build refuses to navigate to external URLs;
`<webview>` rejected; CSP violations logged; custom protocols resolve;
path-traversal attempts on `plugin:` return 403; permission handler
denies `camera` / `geolocation`.

### Commits

1. `feat(shell): CSP builder with dev carveouts`
   - `src/main/security/csp.ts` — extract from existing `security.ts`
   - Test matrix: dev has `'unsafe-inline' 'unsafe-eval' <devUrl>`;
     prod stays strict
2. `feat(shell): Chromium permission allowlist`
   - `src/main/security/permissions.ts` — `ALLOWED_PERMISSIONS` set
   - `setPermissionRequestHandler` + `setPermissionCheckHandler`
3. `feat(shell): session setup module`
   - `src/main/security/setup.ts` — applies CSP header + permission handlers
4. `feat(shell): ephemeral sessions for detached windows`
   - `src/main/security/ephemeral-session.ts` — factory for
     `session.fromPartition('persist:ephemeral-<uuid>', { cache: false })`
5. `feat(shell): navigation guards per window`
   - `src/main/windows/navigation-guard.ts` — will-navigate, will-attach-webview,
     setWindowOpenHandler with external-URL passthrough
6. `feat(shell): protocol registration + host:// + plugin://`
   - `src/main/protocols/register.ts` — `registerSchemesAsPrivileged` at module load
   - `src/main/protocols/host-protocol.ts` — serve from packaged assets
   - `src/main/protocols/plugin-protocol.ts` — resolve via runtime;
     path-traversal guard with resolved-path prefix check
   - `src/main/protocols/mime.ts` — small content-type table
7. `feat(shell): runtime fuse sanity check`
   - `src/main/app/fuse-check.ts` — warn-log if packaged build detects
     flipped-off fuses are on (defense-in-depth; the build flips them)

---

## Phase 3 — Kernel ECS + plugin host skeleton

**Goal:** get the plugin lifecycle state machine running in the
renderer-side ECS world. No real plugins yet — a stub plugin at
`/tmp/stub-plugin` proves discovery → resolve → activate works.

**Verification:** manifest discovery logs a PluginManifest component per
stub; resolve produces a topological order; activation fires
`onActivate` and emits `plugin.activated` on the event port.

### Commits

1. `feat(runtime): kernel ECS world`
   - `core/runtime/src/ecs/world.ts` — `createKernelWorld()`
   - `core/runtime/src/ecs/components.ts`, `tags.ts`
2. `feat(runtime): plugin host discovery`
   - `core/runtime/src/plugin-host/discovery.ts` — scan 3 dirs, parse
     `plugin.json`, Zod-validate, create ECS entities
   - Wires to `VIBE_CTL_DEV_PLUGINS` env for T3 dev
3. `feat(runtime): dependency resolver (topological)`
   - `core/runtime/src/plugin-host/resolver.ts`
   - Fails on cycles, missing non-optional deps
4. `feat(runtime): PluginContext builder`
   - `core/runtime/src/plugin-host/context-builder.ts` — builds a
     stub `ctx` with identity + logger + `signal`; capabilities added
     as registries land
5. `feat(runtime): service + command + widget-type registries`
   - `core/runtime/src/registries/{service,command,widget-type}-registry.ts`
   - All backed by ECS components (entities per registered item)
6. `feat(runtime): disposable tracker`
   - `core/runtime/src/plugin-host/disposable-tracker.ts`
7. `feat(runtime): activation + deactivation systems`
   - `core/runtime/src/ecs/systems/{activation,deactivation}-system.ts`
   - State transitions emit events over the event port
8. `feat(runtime): supervisor restart policy for kernel utility`
   - `src/main/kernel/supervisor.ts` — restart with `[1s, 4s, 16s]` backoff
   - Renderer receives `kernel.reconnecting` event during gap
9. `feat(runtime): crash-recovery helper`
   - `core/runtime/src/plugin-host/crash-recovery.ts` — shared backoff
     logic reused by split-plugin supervisor in Phase 6

---

## Phase 4 — Sync fabric

**Goal:** NapiNode, kernel docs, version gate. Two devices on a tailnet
can see each other; kernel docs sync; behind-version client is gated.

**Verification:** launching a second instance with `VIBE_CTL_DEVICE_ID`
override shows peer joined events; writing a dummy key to
`kernel/user-settings` on A appears on B; bumping `minKernelVersion` on
B blocks A until A is updated.

### Commits

1. `feat(runtime): mesh-node wrapper`
   - `core/runtime/src/sync/mesh-node.ts` — wraps `@vibecook/truffle`
     NapiNode with a kernel-friendly API
2. `feat(runtime): four kernel docs`
   - `core/runtime/src/sync/kernel-docs.ts` — opens `kernel/plugin-inventory`,
     `kernel/canvas-layout`, `kernel/user-settings`, `kernel/permissions`
3. `feat(runtime): doc authority + persistence`
   - `core/runtime/src/sync/doc-authority.ts` — holds authoritative Loro
     replicas; broadcasts deltas to subscribed renderer ports
   - `core/runtime/src/kernel-utility/persistence.ts` — snapshot read/write
4. `feat(runtime): version beacons + version gate`
   - `core/runtime/src/sync/version-beacons.ts`
   - `core/runtime/src/sync/version-gate.ts`
   - Renderer consumes: transitions to `version-gate` screen when behind
5. `feat(runtime): doc-router (per-renderer port fanout)`
   - `core/runtime/src/kernel-utility/doc-router.ts`
   - Main's port-router (`src/main/kernel/port-router.ts`) mints
     channels and hands one end to each renderer, the other to the
     kernel utility
6. `feat(renderer): KernelDocProvider + useKernelDoc`
   - `src/renderer/host/KernelDocProvider.tsx` — opens per-renderer
     doc-sync port received from handshake
   - `src/renderer/host/useKernelDoc.ts` — reactive handle over the
     renderer-local Loro replica
7. `feat(runtime): sync-bridge-system`
   - `core/runtime/src/ecs/systems/sync-bridge-system.ts` — mirrors
     Loro deltas into kernel ECS components so reactive queries fire
8. `feat(runtime): settings manager on top of kernel/user-settings`
   - `core/runtime/src/settings/settings-manager.ts`
9. `feat(runtime): offline-mode toggle`
   - `core/runtime/src/sync/offline-mode.ts`

---

## Phase 5 — Canvas + sync bridge

**Goal:** canvas engine boots in the `main` screen, widgets persist via
`kernel/canvas-layout`, placeholders render for unknown widget types.

**Verification:** dropping a widget on device A shows on device B as a
`MissingPluginPlaceholder`; moving it on A moves it on B; reloading A
rehydrates layout from the persisted snapshot.

### Commits

1. `feat(canvas): update canvas-sync-adapter for doc-sync port`
   - `core/canvas/src/canvas-sync-adapter.ts` — subscribes to the
     renderer-local Loro replica (via `useKernelDoc`), not NapiNode
2. `feat(renderer): EngineProvider inside `main` screen`
   - `src/renderer/screens/main/workspace/EngineProvider.tsx`
   - `src/renderer/screens/main/workspace/useEngine.ts`
3. `feat(renderer): MissingPluginPlaceholder mounting`
   - Already in `core/ui/placeholders/MissingPluginPlaceholder.tsx`;
     wire into the canvas engine's widget-type-not-found path
4. `feat(renderer): useWorkspaceShortcuts`
   - `src/renderer/screens/main/workspace/useWorkspaceShortcuts.ts`
5. `test(e2e): two-device canvas widget sync smoke`
   - Drive two electron-vite dev instances on same tailnet; assert
     widget appears cross-device within 2s

---

## Phase 6 — Split-plugin utility hosting

**Goal:** spawn, supervise, and RPC-proxy a split plugin. `ctx.rpc`
works; crashes restart; deactivation is clean.

**Verification:** stub split-plugin with a main half that exposes
`ping()` and a renderer half that calls it → round-trip works; kill
`utilityProcess.pid` → supervisor restarts; 4th crash within 30s →
plugin marked Failed.

### Commits

1. `feat(shell): split-plugin utility-host`
   - `src/main/plugins/utility-host.ts` — fork per split plugin with
     env + serviceName
2. `feat(runtime): split-plugin supervisor`
   - `core/runtime/src/plugin-host/split-supervisor.ts` — lifecycle +
     crash-recovery integration
3. `feat(runtime): Comlink RPC wiring for ctx.rpc`
   - `core/runtime/src/plugin-host/context-builder.ts` — `ctx.rpc` only
     present for split plugins; exposes `expose()` / `connect<T>()`
4. `feat(shell): broker RPC port per split plugin`
   - `src/main/ipc/broker.ts` — on split activation, mint channel,
     ship one end to utility, other into the renderer handshake payload
5. `feat(renderer): widget reconnect UI during utility restarts`
   - Widgets stay mounted; `ctx.rpc` proxy emits 'reconnecting' until
     the utility half reattaches
6. `feat(runtime): stdio routing to plugin log files`
   - `src/main/logging/plugin-stream.ts` — per-plugin Pino child writes
     to `logs/plugins/{pluginId}.log` with 7-day rotation

---

## Phase 7 — Chrome, native helpers, detached windows, dynamic island

**Goal:** the visible polish. Traffic-light alignment, tray, detached
widgets with inter-renderer bridge, Swift NotchHelper under
`plugin-dynamic-island`.

**Verification:** detaching a widget on macOS opens a frameless window
aligned to the drag-region strip; closing it reattaches; tray shows
live peer count; NotchHelper launches when dynamic-island plugin
activates on macOS.

### Commits

1. `feat(shell): TrafficLightSpacer + DragRegion polish`
   - `src/renderer/chrome/TrafficLightSpacer.tsx`
   - `src/renderer/chrome/WindowControls.tsx` (win/linux)
2. `feat(shell): detached widget window factory`
   - `src/main/windows/detached-widget.ts`
   - Uses ephemeral session from Phase 2
3. `feat(shell): detached-widget handler in HostMethod.windows.detach`
   - `src/main/ipc/handlers/windows.ts`
4. `feat(renderer): renderer ↔ renderer widget bridge`
   - Main window exports component-delta for the detached entity over
     a renderer-to-renderer MessagePort (brokered by main)
   - Detached window applies deltas into a local single-entity ECS
5. `feat(shell): tray + menu content backed by ECS queries`
   - `src/main/tray/{tray,menu-items}.ts`
   - Mesh peers / pending approvals from kernel ECS via host invoke
6. `feat(shell): app menu (macOS + win/linux)`
   - `src/main/menu/{app-menu,macos,win-linux}.ts`
7. `feat(plugin-api): ctx.process.spawnHelper contract`
   - `core/plugin-api/src/native-helper.ts` — HelperHandle + options
   - `core/plugin-api/src/context.ts` — extend PluginContext
   - `core/plugin-api/src/permissions.ts` — `'native-helper'` string
8. `feat(shell): spawn-helper implementation + signature check`
   - `src/main/native/spawn-helper.ts`
   - `src/main/native/signature-check.ts` (macOS `codesign -v`,
     Windows `signtool verify`)
9. `feat(shell): dynamic-island window factory`
   - `src/main/windows/dynamic-island.ts` — frameless, transparent,
     non-activating, always-on-top, `visibleOnAllWorkspaces: true`
10. `feat(shell): deep-link handler → kernel command dispatch`
    - `src/main/app/deep-links.ts` — parse `vibe-ctl://…`, route to
      runtime command registry on second-instance event

---

## Phase 8 — Packaging, fuses, updater

**Goal:** a signed, notarized, fuse-flipped, ASAR-integrity-validated
installer on all three OSes.

**Verification:** `pnpm package` on a mac produces a notarized .dmg;
Windows .exe is signed; running `npx asar-integrity verify` against the
packaged app succeeds; `--inspect` flag on the packaged binary is
rejected (fuse off).

### Commits

1. `feat(desktop): electron-builder.yml`
   - `apps/desktop/electron-builder.yml` — asar, asarUnpack
     (NotchHelper, .node), extraResources, publish to GitHub
2. `feat(desktop): macOS entitlements`
   - `apps/desktop/build/entitlements.mac.plist` — minimal set
3. `feat(desktop): Electron Fuses config + afterPack`
   - `apps/desktop/build/fuses.config.json`
   - `apps/desktop/scripts/afterPack.mjs` — `@electron/fuses`
4. `feat(desktop): macOS notarization afterSign hook`
   - `apps/desktop/scripts/afterSign.mjs` — electron-notarize
5. `feat(shell): auto-updater + staged rollout`
   - `src/main/updater/auto-updater.ts` — check on launch + every 6h
   - `src/main/updater/staged-rollout.ts` — parse stagingPercentage
     from fetched `latest*.yml`
6. `chore(ci): release workflow`
   - `.github/workflows/release.yml` — per-OS matrix builds on tag
7. `feat(desktop): deep-link registrations per-OS`
   - macOS Info.plist CFBundleURLTypes, Windows registry, Linux
     `.desktop` file

---

## Phase 9 — First first-party plugin end-to-end

**Goal:** land `plugins/claude-code` per spec 01 §13.1. This is the
proof that the whole stack works together; every subsequent first-party
plugin follows the same template.

**Verification:** spec 02 §6 walkthrough with `claude-code` standing in
for `terminal` — project list widget appears; session index syncs
cross-device; crashing the utility restarts cleanly; uninstalling
leaves a MissingPluginPlaceholder.

### Commits

1. `feat(plugin-claude-code): scaffold via create-plugin`
   - `plugins/claude-code/` with manifest, tsup config, split entry
2. `feat(plugin-claude-code): main half — spaghetti-sdk wiring`
   - `src/main.ts` — createSpaghettiService, hook watcher,
     `ctx.rpc.expose`
3. `feat(plugin-claude-code): renderer half — service + widget`
   - `src/renderer.ts` — provides `claude-code` service, registers
     project-list widget
4. `feat(plugin-claude-code): session-index SyncedStore`
   - `sync.data` declares per-device `session-index`; main publishes
     on initialize; renderer queries across peers
5. `feat(plugin-claude-code): permission gates`
   - `ctx.permissions.require('claude-code:read-transcripts')` before
     readTranscript; prompt UI from kernel modal
6. `feat(desktop): bundle-plugins turbo task`
   - `turbo.json` `bundle-plugins` pipeline copies
     `plugins/*/dist → apps/desktop/resources/plugins/`
7. `test(e2e): claude-code cross-device smoke`
   - Two-device harness: install on A, observe session index on B,
     install on B → widgets replace placeholder

---

## Cross-phase tracks (done in parallel, not serial)

These don't block the critical path but should land as we go — each
associated with the phase that first exposes them.

- **Logging discipline** (Phase 1 onward): every new module uses the
  pino scope factory; no `console.log` in committed code.
- **Error screens** (Phase 3 onward): any unrecoverable boot failure
  routes to `ErrorScreen`. Reset-app flow implemented alongside.
- **Documentation** (all phases): when a decision in spec 05 changes,
  update spec 05 first, then the code.
- **Type freshness** (all phases): `pnpm typecheck` is the pre-push
  hook; no `any` added without a `TODO(typed)` comment.

---

## Out of scope for this plan

Tracked for future planning but explicitly not in these nine phases:

- Other first-party plugins (terminal, notifications, dynamic-island,
  project-manager, command-palette, side-panels, themes, mesh-widgets,
  quick-actions) — each its own follow-up plan.
- Registry/marketplace UX (spec 04) — `plugin-extension-hub` plugin is
  a separate plan.
- Mobile PWA (spec 04 + outdated 09) — separate plan; requires the
  truffle reverse-proxy + Hono server to be hardened first.
- V8 snapshots, WebGPU backend, full-kernel separation — open questions
  in spec 05, revisited after real profiling.
- Crash-reporter-to-cloud — deliberately deferred; local error screen
  + log path is the v1 story.

---

## How to use this document

- **Treat it as a rolling contract**, not an immutable artifact. When a
  commit in a phase splits or merges, update the list.
- **Don't let a phase drag past its verification step.** If Phase 4's
  two-device sync doesn't work, the bug is in this plan, not in the
  next phase.
- **Commit messages mirror the headings verbatim.** Makes `git log`
  grep-friendly against this doc.
- **One PR per phase** is the default rhythm, with the phase's
  verification step in the PR description. Some phases (2, 8) may
  split into 2–3 PRs given review surface; flag in advance.
