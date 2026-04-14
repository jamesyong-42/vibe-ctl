# vibe-ctl documentation

All authoritative docs for the architecture, plugin API, kernel runtime,
build layout, and marketplace model.

## Current specs

Five documents define the current architecture. Read in order.

| File | Contents |
|---|---|
| [00-overview.md](specs/00-overview.md) | Vision, module inventory, tech stack, architecture diagram |
| [01-extension-system.md](specs/01-extension-system.md) | Plugin manifest, `Plugin` class, `PluginContext`, widget system, services, permissions |
| [02-kernel-runtime.md](specs/02-kernel-runtime.md) | Kernel implementation: three layers, three sync principles, lifecycle, teardown |
| [03-monorepo-layout.md](specs/03-monorepo-layout.md) | File tree, build pipeline, first-party plugin catalogue |
| [04-registry-marketplace.md](specs/04-registry-marketplace.md) | Git-based registry, publishing, installation, updates, trust model |

## Architecture

A minimal kernel (load / run / render / schedule / interact) plus plugins
for everything else. First-party plugins use the same public API as
third-party. No "core features" bypass the plugin system.

```
┌──────────────────────────────────────────────────────┐
│  Plugins (first-party + community, same API)          │
│  claude-code · terminal · notifications · themes      │
│  dynamic-island · side-panels · mesh-widgets · ...    │
└──────────────────────────────────────────────────────┘
                      ↕ @vibe-ctl/extension-api
┌──────────────────────────────────────────────────────┐
│  Kernel — three layers                                │
│  Plugin Host │ Sync Fabric │ Platform                 │
└──────────────────────────────────────────────────────┘
                      ↕ wraps
┌──────────────────────────────────────────────────────┐
│  External modules                                     │
│  truffle · spaghetti-sdk · avocado-sdk                │
│  infinite-canvas · reactive-ecs · xterm-r3f · r3f-msdf│
└──────────────────────────────────────────────────────┘
```

## Outdated specs

Earlier drafts (v0.1.0, v0.2.0) assumed a service-layer architecture
with bundled widgets. Superseded by the kernel + plugins model. Preserved
in `specs/outdated/` for reference:

```
specs/outdated/
  01-foundation.md        → replaced by current 03-monorepo-layout.md
  02-electron-shell.md    → replaced by current 02-kernel-runtime.md §2
  03-ipc-protocol.md      → replaced by service registry + ctx.rpc
  04-agent-management.md  → will become plugin-claude-code spec
  05-canvas-widgets.md    → replaced by current 01 + 02 + 05
  06-terminal.md          → will become plugin-terminal spec
  07-mesh-network.md      → folded into kernel sync fabric
  08-notifications.md     → will become plugin-notifications spec
  09-mobile.md            → will become plugin-mobile-pwa spec
  10-implementation.md    → will be rewritten as a phased roadmap
```

## Iteration principles

- **Keep specs lean.** Prefer examples over prose. Prefer code sketches
  over paragraphs.
- **Favor removal over addition.** Every section justifies its existence.
- **Three worked examples minimum.** Any new mechanism must survive being
  applied to three concrete plugins before it ships.
- **Move outdated ideas to `outdated/`.** Don't delete; don't let stale
  ideas muddy the source of truth.
- **Version the spec set.** Bump when architectural shape changes.
  v0.1 = services-first, v0.2 = kernel-first, v0.3 = current lean iteration.
