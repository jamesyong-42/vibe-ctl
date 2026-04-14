# vibe-ctl: AI Agent Control Center

## Project Specification

**Version:** 0.3.0-draft
**Date:** 2026-04-13
**Status:** Lean specs. Foundation-first; iterating fast before we scaffold code.

---

## Current Specs

Five documents define the current architecture. Read in order.

| File | Contents |
|---|---|
| [00-overview.md](specs/00-overview.md) | Vision, module inventory, tech stack, architecture diagram |
| [01-extension-system.md](specs/01-extension-system.md) | Plugin manifest, `Plugin` class, `PluginContext`, widget system, services, permissions |
| [02-kernel-runtime.md](specs/02-kernel-runtime.md) | Kernel implementation: discovery, activation, service registry, teardown, hot-reload |
| [03-monorepo-layout.md](specs/03-monorepo-layout.md) | File tree, build pipeline, first-party plugin catalogue |
| [04-registry-marketplace.md](specs/04-registry-marketplace.md) | Git-based registry, publishing, installation, updates, trust model |

## Architecture (One Line)

**A minimal kernel (load / run / render / schedule / interact) plus plugins
for everything else.** First-party plugins use the same public API as
third-party. No "core features" that bypass the plugin system.

```
┌──────────────────────────────────────────────────────┐
│  Plugins (first-party + community, all use same API) │
│  mesh  claude-code  terminal  notifications          │
│  dynamic-island  themes  side-panels  ...            │
└──────────────────────────────────────────────────────┘
                      ↑↓ @vibe-ctl/extension-api
┌──────────────────────────────────────────────────────┐
│  Kernel: 5 verbs (load / run / render / schedule /   │
│         interact). That's it.                         │
└──────────────────────────────────────────────────────┘
                      ↑↓ wraps
┌──────────────────────────────────────────────────────┐
│  External modules: truffle, spaghetti-sdk,           │
│  avocado-sdk, infinite-canvas, xterm-r3f, r3f-msdf   │
└──────────────────────────────────────────────────────┘
```

## Outdated Specs

The initial spec set (v0.1.0-draft, April 12) assumed a service-layer
architecture with bundled widgets. That's been replaced by the
extension-first architecture above. Previous specs are preserved in
`specs/outdated/` for reference but are no longer authoritative:

```
specs/outdated/
  01-foundation.md
  02-electron-shell.md
  03-ipc-protocol.md
  04-agent-management.md
  05-canvas-widgets.md
  06-terminal.md
  07-mesh-network.md
  08-notifications.md
  09-mobile.md
  10-implementation.md
```

Useful for domain-logic reference (what the claude-code plugin needs to
do, what the mesh plugin needs to do) but the architectural framing is
superseded.

## Iteration Principles

While the foundation is still being designed:

- **Keep specs lean.** Prefer examples over prose. Prefer code sketches
  over paragraphs.
- **Favor removal over addition.** Every section should justify its
  existence. Cut VS Code-style over-engineering.
- **Three worked examples minimum.** Any new mechanism must survive being
  applied to three concrete plugins before we ship it.
- **Move outdated ideas to `outdated/`.** Don't delete; don't let stale
  ideas muddy the source of truth either.
- **Version the spec set.** Bump the top-level version when architectural
  shape changes. v0.1 = services-first; v0.2 = kernel-first; v0.3 =
  current lean iteration.
