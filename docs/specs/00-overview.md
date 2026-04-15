# 00 -- Overview & Vision

> The "what" and "why" of vibe-ctl. Read this first, then drill into 01-04.

---

## Vision

vibe-ctl is a cross-platform AI agent control center. One focused workspace
to monitor, manage, and interact with all your Claude Code sessions across
every device you own.

**The problem:** As you scale to running many AI agents across multiple
machines, you lose track. Tabs pile up. Screens scatter. Approval requests
go unnoticed. Context-switching kills flow.

**The solution:** A single infinite canvas dashboard where every agent,
terminal, and project is laid out spatially. Control a session on your PC
from your Mac. Approve a tool request from your phone. Get notified at the
notch when something needs attention.

---

## Core Capabilities

1. **Infinite Canvas Dashboard** — Spatial layout with widgets for agents,
   terminals, projects, notifications. Zoom for overview vs detail. Navigate
   into project containers for focused views.

2. **Cross-Device Agent Control** — See and control sessions running on any
   machine in your mesh network. Resume, approve, monitor — all from one
   place.

3. **Terminal Session Sync** — Open terminals that sync across devices via
   the truffle mesh.

4. **macOS Dynamic Island** — Native notch widget for quick approvals and
   agent status without switching apps.

5. **Agent Management** — Project-specific agents (regular Claude Code
   sessions) and general-purpose agents (spawned by vibe-ctl with
   pre-configured CLAUDE.md).

6. **Notifications & Approvals** — Real-time across all devices; approve
   from canvas, tray, notch, or mobile.

---

## Architectural Stance

**Minimal kernel, plugins for everything else.** The kernel provides
five verbs (load / run / render / schedule / interact) plus the sync fabric.
Every domain feature — agent management, terminals, notifications, dynamic
island, themes — is a plugin using the same public API a third-party plugin
would use. No special treatment for first-party code.

See **spec 01** for the plugin contract, **spec 02** for how the kernel
implements it.

---

## Architecture Diagram

```
┌──────────────────────────────────────────────────────────────┐
│  PLUGINS (first-party bundled + third-party from registry)   │
│                                                               │
│  claude-code · terminal · notifications · dynamic-island      │
│  themes · project-manager · side-panels · command-palette     │
│  mesh-widgets · quick-actions · ...community plugins          │
└──────────────────────────────────────────────────────────────┘
                         ↕ @vibe-ctl/plugin-api
┌──────────────────────────────────────────────────────────────┐
│  KERNEL  (three layers, no domain logic)                      │
│                                                               │
│  Layer 3 · Plugin Host                                        │
│           discovery, lifecycle, service registry, ctx         │
│                                                               │
│  Layer 2 · Sync Fabric                                        │
│           mesh (truffle), CrdtDoc, SyncedStore,               │
│           four kernel-managed shared docs                     │
│                                                               │
│  Layer 1 · Platform                                           │
│           Electron shell, canvas substrate (infinite-canvas), │
│           process management                                  │
└──────────────────────────────────────────────────────────────┘
                         ↕ wraps
┌──────────────────────────────────────────────────────────────┐
│  EXTERNAL MODULES                                             │
│                                                               │
│  truffle  spaghetti-sdk  avocado-sdk  infinite-canvas         │
│  reactive-ecs  xterm-r3f  r3f-msdf                            │
└──────────────────────────────────────────────────────────────┘
```

### The Three Sync Principles

From spec 02 §3, the whole cross-device model reduces to:

1. **Presentation syncs; runtime doesn't.** Canvas layout, settings,
   permissions sync. Running services, processes, connections don't.
2. **Devices own their truth.** Each device publishes what's true about
   *itself*; others read via SyncedStore but never mutate another's slice.
3. **State flows reactively.** All kernel state lives in an ECS world;
   UI subscribes to queries; sync deltas mutate components; queries
   re-fire; widgets re-render. No manual sync wiring in plugin code.

---

## Existing Module Inventory

vibe-ctl's unfair advantage: the hard infrastructure already exists.

| Module | Package | Version | Role |
|---|---|---|---|
| **Truffle** | `@vibecook/truffle` | 0.4.2 | Mesh network on Tailscale. Owns NapiNode, CrdtDoc (Loro), SyncedStore, reverse proxy (auto-TLS). **Kernel dependency.** |
| **Spaghetti SDK** | `@vibecook/spaghetti-sdk` | 0.5.1 | Claude Code session index + FTS5 + channel + React. Consumed by `plugin-claude-code`. |
| **Avocado SDK** | `@vibecook/avocado-sdk` | 0.2.0 | Terminal sync (node-pty + IPC + mesh transport). Consumed by `plugin-terminal`. Truffle is peer dep. |
| **Infinite Canvas** | `@jamesyong42/infinite-canvas` | 0.1.0 | ECS canvas engine. Archetype-first widget API. Kernel substrate. |
| **Reactive ECS** | `@jamesyong42/reactive-ecs` | 0.1.1 | Reactive ECS runtime. Shared between infinite-canvas world and kernel world. |
| **xterm-r3f** | `xterm-r3f` | 0.1.0 | WebGL terminal rendering. Consumed by `plugin-terminal`. |
| **r3f-msdf** | `r3f-msdf` | 0.1.0 | MSDF text rendering. Peer dep of xterm-r3f. |
| **Vibe Island** | (local prototype) | — | macOS dynamic island (Electron + Swift helper). Consumed by `plugin-dynamic-island`. |

### Module Locations

```
~/Projects/project100/p008/truffle                              -- Mesh networking
~/Projects/project100/p008/spaghetti                            -- Claude Code SDK
~/Projects/project100/p008/avocado                              -- Terminal SDK
~/Projects/project100/infinite-canvas                           -- Canvas engine
~/Projects/project100/reactive-ecs                              -- ECS runtime
~/Projects/project100/p013/xterm-r3f                            -- WebGL terminal
~/Projects/project100/p014/r3f-msdf                             -- MSDF text
~/Projects/project100/research/vibe-island/prototype-b-electron-swift  -- Dynamic island
```

---

## Tech Stack Summary

| Layer | Choice | Version |
|---|---|---|
| **Runtime** | | |
| Electron | 41.2.0 | Shell, windows, native integration |
| Node.js | 24.x (bundled) | ESM main process, utilityProcess for split plugins |
| TypeScript | 5.7+ | Strict mode, project references |
| **Monorepo** | | |
| pnpm | 10.x | Workspaces, strict hoisting |
| Turborepo | 2.x | Task pipeline, content-hashed cache |
| electron-vite | 5.x | Dev bundler (HMR for main/preload/renderer) |
| electron-builder | 26.x | Packaging, code signing, notarization |
| **Kernel** | | |
| reactive-ecs | 0.1.1 | Shared ECS runtime (canvas world + kernel world) |
| truffle | 0.4.2 | Mesh, CrdtDoc, SyncedStore, reverse proxy |
| infinite-canvas | 0.1.0 | Canvas substrate |
| **UI** | | |
| React | 19.2 | Host-provided, all plugins share |
| Three.js + R3F | 0.183 / 9.5 | WebGL layer |
| Tailwind CSS | 4.x | Styling |
| Zod | 3.x | Manifest + config validation |
| **Mobile (Phase 4+)** | | |
| PWA | served by desktop | Lightweight build, separate from desktop renderer |
| Hono + ws | 4.12 / 8.20 | Local HTTP server (zero transitive deps) |
| Tailscale TLS | via truffle proxy | Auto Let's Encrypt on `*.ts.net` |
| Web Push API | via Service Worker | Background notifications |

Deeper rationale in `specs/03-monorepo-layout.md`.

---

## Spec Index

| File | Contents |
|---|---|
| [`00-overview.md`](00-overview.md) | This file. Vision, modules, architectural stance |
| [`01-plugin-system.md`](01-plugin-system.md) | Plugin manifest, `Plugin` class, `PluginContext`, widgets, services, sync API |
| [`02-kernel-runtime.md`](02-kernel-runtime.md) | Kernel layers, three sync principles, worked walkthrough, edge-case policies |
| [`03-monorepo-layout.md`](03-monorepo-layout.md) | File tree, packages, build pipeline, plugin catalogue |
| [`04-registry-marketplace.md`](04-registry-marketplace.md) | Git-based registry, publishing, installation, updates |
| [`05-electron-app-architecture.md`](05-electron-app-architecture.md) | Platform-layer deep-dive: processes, windows, preload, IPC, protocols, security, renderer composition, packaging |

Previous domain specs (agent-management, terminal, mesh-network, notifications,
mobile, implementation-plan) are archived in `specs/outdated/`. Their content
is still useful as reference for the domain logic of specific plugins, but
the architectural framing (service-layer vs kernel+plugins) is superseded.

---

## Key Decisions Locked

### Architecture
- **Kernel + plugins, not services + widgets.** First-party plugins use the
  same public API as community plugins. (spec 01, 02)
- **Truffle is kernel, not a plugin.** The kernel needs sync to sync its
  own state (plugin inventory, canvas layout). Chicken-and-egg resolved by
  making mesh a Layer 2 kernel responsibility. Plugins consume mesh through
  `ctx.sync.*` and `ctx.mesh.*` façades. (spec 02 §3)
- **Three sync principles over seven edge-case policies.** Presentation
  syncs, devices own their truth, state flows reactively. Every policy
  question derives from these. (spec 02 §3)
- **reactive-ecs host-provided.** Both the canvas world (infinite-canvas)
  and the kernel world share one ECS runtime. Plugins use it for any
  custom canvas systems. (spec 02 §7)

### Version Strategy
- **Kernel version is authoritative (Discord-style forced upgrade).** Peers
  publish `minKernelVersion`; behind-version devices refuse to start. No
  cross-version CRDT migration layer needed. (spec 02 §4.1)
- **Plugin versions are per-device.** Each device owns its installed version.
  Plugin manager UI shows divergence and lets users reconcile explicitly. No
  automatic downgrade. (spec 02 §9)

### Canvas Sync
- **Canvas layout lives in a kernel-managed CrdtDoc.** Widgets are entries
  in a Loro `LoroMap`. Concurrent moves on different widgets merge cleanly.
- **CRDT adapter lives in vibe-ctl, not infinite-canvas.** The canvas
  library stays sync-agnostic; the adapter filters to `Widget` entities
  and bridges ECS ↔ Loro using the canvas library's existing
  `serializeEntities` + `onFrame` APIs. (spec 02 §4.2)

### Sync Semantics
- **Grants stay local; revocations sync.** A compromised device cannot
  escalate trust elsewhere, but explicit revocation safely reduces
  capability everywhere. (spec 02 §9)
- **Undeclared `ctx.sync.crdtDoc('x')` throws.** Plugins must declare every
  synced doc in manifest's `sync.data[]`. Users see what syncs at install;
  no silent cross-device data leaks. (spec 01 §8)
- **Uninstalls don't propagate.** Per-device inventory. Canvas widgets of
  removed plugins render as missing-plugin placeholders with `[Install]`
  button. (spec 02 §9)

### Module Consumption
- **`.pnpmfile.cjs` opt-in linking.** Set `VIBE_LINK_LOCAL=1` to link
  sibling module checkouts during dev; default install + CI resolve
  from npm so the committed lockfile stays portable. (spec 03 §2)
- **Host-provided singletons.** `@vibe-ctl/plugin-api`, `react`,
  `react-dom`, `@jamesyong42/infinite-canvas`, `@jamesyong42/reactive-ecs`,
  `@vibecook/truffle` — plugins mark these `external` in their bundler.
  Kernel injects single instances. (spec 03 §4)

### Distribution
- **Git is the registry.** `vibe-ctl/plugins` public repo with `plugins.json`
  as index. Each plugin hosts its own releases on GitHub. No backend
  infrastructure. (spec 04 §2)
- **Mobile is a PWA.** Served by desktop's Hono on localhost; truffle proxy
  wraps it with Tailscale-issued Let's Encrypt HTTPS. Push via Web Push API.
  No native app, no relay server, no centralized infrastructure. (spec 04
  + spec 03 §6 plugin-mobile-pwa)

---

## Decisions

High-level decisions that span multiple specs. Detailed rationale lives in
the respective spec.

- **PWA fixed port 3100** — Web Push subscriptions are origin+port specific;
  dynamic port breaks resubscribe after restart.
- **PWA server: explicit opt-in** (Settings → Mobile Access) — most users
  don't need it; don't run an HTTP server on by default.
- **VAPID keys persisted to `kernel/user-settings`** — one user-global
  keypair, encrypted via safeStorage.
- **Canvas CrdtDoc: one doc for all widgets** — simpler at our scale; split
  later only if profiling demands.
- **`minKernelVersion` in separate `kernel/version-beacons` SyncedStore
  slice** — fast boot check; avoids scanning all docs.
- **Biome for linting + formatting** — reactive-ecs and infinite-canvas
  already use it; single config; ecosystem consistency.
- **First-party plugins version in lockstep with app** — one version number
  for users; simpler releases.

Layer-specific decisions live at the bottom of specs 01-04.
