# vibe-ctl

> Your AI agents, one focused workspace. Across every device you own.

**vibe-ctl** is a cross-platform control center for Claude Code sessions.
Monitor, control, and interact with all your AI agents from a single
infinite canvas. See an agent running on your PC from your Mac. Approve a
tool request from your phone. Get notified at the notch when something
needs attention.

Built on an **extension-first architecture**: a minimal kernel + plugins.
First-party plugins use the same public API as third-party.
No "core features" that bypass the plugin system.

> **Status:** Phase 0 — foundation scaffolded. Kernel, canvas, 10 first-party
> plugins, and tooling all have the right shape, typecheck clean, and build.
> Runtime behavior is stubbed; implementation is the next phase.

---

## What you can do with it

- **Infinite canvas dashboard** — widgets for agents, terminals, projects,
  notifications. Zoom for overview vs detail.
- **Cross-device agent control** — see and approve tool requests on any
  machine in your mesh network.
- **Terminal session sync** — open terminals that mirror across devices in
  real-time (via the truffle mesh).
- **macOS dynamic island** — native notch widget for quick approvals.
- **Agent templates** — spawn pre-configured general-purpose agents
  (code reviewer, researcher, documenter) in any workspace.

---

## Architecture

```
┌──────────────────────────────────────────────────────┐
│  Plugins (first-party + community, same API)         │
│  claude-code · terminal · notifications · themes     │
│  dynamic-island · project-manager · mesh-widgets · … │
└──────────────────────────────────────────────────────┘
                      ↕ @vibe-ctl/extension-api
┌──────────────────────────────────────────────────────┐
│  Kernel — three layers                               │
│  Plugin Host │ Sync Fabric │ Platform                │
└──────────────────────────────────────────────────────┘
                      ↕ wraps
┌──────────────────────────────────────────────────────┐
│  External modules                                    │
│  truffle · spaghetti-sdk · avocado-sdk               │
│  infinite-canvas · reactive-ecs · xterm-r3f · r3f-msdf │
└──────────────────────────────────────────────────────┘
```

Read [docs/specs/00-overview.md](docs/specs/00-overview.md) for the full
architectural picture.

---

## Getting started

### Prerequisites

- **Node.js 24+** (see `.node-version`)
- **pnpm 10+** (`corepack enable` + `corepack prepare pnpm@latest --activate`)
- On macOS: **Xcode Command Line Tools** (for the dynamic-island Swift helper)

### Install and run

```bash
pnpm install                      # Installs all workspace deps
pnpm build                        # Build all packages (turbo)
pnpm dev                          # Watch mode + Electron dev
```

### Useful scripts

```bash
pnpm typecheck                    # tsc --noEmit across all packages
pnpm lint                         # Biome check
pnpm format                       # Biome format --write
pnpm package                      # electron-builder (requires prior build)
pnpm create-plugin <name>         # Scaffold a new third-party plugin
```

Pre-commit hooks run Biome on staged files; pre-push runs `pnpm typecheck`.

---

## Project structure

```
vibe-ctl/
├── core/                   # The kernel (4 packages)
│   ├── extension-api/      # Published. Plugin contract (types + Plugin class).
│   ├── runtime/            # Plugin host + sync fabric.
│   ├── canvas/             # Canvas substrate + CRDT sync adapter + UI primitives.
│   └── shell/              # Electron shell (main / preload / renderer).
│
├── plugins/                # 10 first-party plugins (T1)
│   ├── claude-code/        # Spaghetti-SDK session manager (split plugin)
│   ├── terminal/           # Avocado-SDK PTY + mesh sync (split plugin)
│   ├── notifications/      # Approval flow + OS notifications (split plugin)
│   ├── dynamic-island/     # Swift helper (macOS-only, split plugin)
│   ├── project-manager/    # Project tree navigator
│   ├── command-palette/    # Cmd+K palette
│   ├── side-panels/        # Left/right panel host
│   ├── themes/             # Theme system
│   ├── mesh-widgets/       # Device status + shared-services widgets
│   └── quick-actions/      # Common action widgets
│
├── apps/desktop/           # Electron packaging (electron-builder)
│
├── tooling/
│   ├── tsconfig/           # Shared tsconfig presets (published)
│   ├── create-vibe-plugin/ # CLI scaffold (published)
│   └── plugin-registry-tools/ # Registry PR CLI (published)
│
└── docs/
    ├── README.md           # Docs index
    └── specs/              # Authoritative specs (00–04)
```

---

## Documentation

| Doc | Contents |
|---|---|
| [docs/specs/00-overview.md](docs/specs/00-overview.md) | Vision, modules, tech stack |
| [docs/specs/01-extension-system.md](docs/specs/01-extension-system.md) | Plugin API (manifest + class + context) |
| [docs/specs/02-kernel-runtime.md](docs/specs/02-kernel-runtime.md) | Kernel internals + sync model |
| [docs/specs/03-monorepo-layout.md](docs/specs/03-monorepo-layout.md) | Build pipeline, package catalogue |
| [docs/specs/04-registry-marketplace.md](docs/specs/04-registry-marketplace.md) | Distribution + trust model |
| [CLAUDE.md](CLAUDE.md) | AI dev instructions (for Claude Code sessions) |

---

## Ecosystem

vibe-ctl integrates first-party open-source modules:

| Module | Role |
|---|---|
| [truffle](https://github.com/jamesyong-42/truffle) | Mesh network on Tailscale; CRDT docs, SyncedStore, reverse proxy |
| [spaghetti-sdk](https://github.com/jamesyong-42/spaghetti) | Claude Code session index + FTS5 + live channel |
| [avocado-sdk](https://github.com/jamesyong-42/avocado) | Terminal sync across the mesh |
| [infinite-canvas](https://github.com/jamesyong-42/infinite-canvas) | ECS canvas engine |
| [reactive-ecs](https://github.com/jamesyong-42/reactive-ecs) | Reactive ECS runtime |
| [xterm-r3f](https://github.com/jamesyong-42/xterm-r3f) | WebGL terminal rendering |
| [r3f-msdf](https://github.com/jamesyong-42/r3f-msdf) | MSDF text rendering (WebGPU-ready) |

---

## License

MIT
