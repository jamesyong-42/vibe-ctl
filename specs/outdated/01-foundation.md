# 01 -- Foundation

> Monorepo structure, build system, dev environment, tooling decisions.
> This is Layer 1 -- everything else builds on top of this.

**Depends on:** Nothing (this is the base)
**Blocks:** All other specs

---

## 1. Monorepo Layout

```
vibe-ctl/
|
|-- package.json                    # Root: workspaces, scripts, engines
|-- pnpm-workspace.yaml             # Workspace glob patterns
|-- turbo.json                      # Turborepo pipeline definitions
|-- tsconfig.json                   # Root TS config (project references)
|-- .npmrc                          # pnpm config (shamefully-hoist, etc.)
|-- .gitignore
|-- .node-version                   # 24
|-- CLAUDE.md                       # AI dev instructions
|-- specs/                          # This spec directory
|
|-- packages/
|   |-- shared/                     # @vibe-ctl/shared
|   |-- store/                      # @vibe-ctl/store
|   |-- protocol/                   # @vibe-ctl/protocol
|   |-- widgets/                    # @vibe-ctl/widgets
|   +-- ui/                         # @vibe-ctl/ui
|
|-- apps/
|   |-- desktop/                    # Electron app
|   |-- mobile/                     # Expo React Native
|   +-- notch/                      # Swift dynamic island helper
|
+-- tooling/                        # Shared configs (tsconfig, eslint, etc.)
    |-- tsconfig/
    |   |-- base.json
    |   |-- react.json
    |   +-- node.json
    +-- eslint/
        +-- base.js
```

## 2. Package Dependency Graph

```
@vibe-ctl/shared          (zero deps -- types, constants only)
     ^
     |
@vibe-ctl/store           (zustand, @vibe-ctl/shared)
     ^
     |
@vibe-ctl/protocol        (@trpc/server, zod, @vibe-ctl/shared)
     ^
     |
@vibe-ctl/ui              (react, @vibe-ctl/shared, @vibe-ctl/store)
     ^
     |
@vibe-ctl/widgets         (react, @jamesyong42/infinite-canvas, xterm-r3f,
     ^                     @vibe-ctl/shared, @vibe-ctl/store, @vibe-ctl/ui)
     |
apps/desktop              (electron, electron-vite, @vibe-ctl/*,
                           @vibecook/truffle, @vibecook/spaghetti-core,
                           @avocado/*)
```

## 3. Package Details

### @vibe-ctl/shared

Zero-dependency package. Types and constants only.

```
packages/shared/
  src/
    types/
      agent.ts            # AgentSession, AgentState, AgentCategory, Project
      terminal.ts         # TerminalSession, PTYConfig, TerminalState
      canvas.ts           # WidgetConfig, CanvasState, ContainerConfig
      mesh.ts             # Device, Peer, DevicePresence, MeshHealth
      notification.ts     # Notification, ApprovalRequest, ApprovalDecision
      index.ts
    constants.ts          # App ID, namespace strings, limits, defaults
    index.ts
  package.json
  tsconfig.json
```

### @vibe-ctl/store

Zustand stores. Works in both Node (main process) and React (renderer).

```
packages/store/
  src/
    agent-store.ts        # Projects, sessions, active agents, search results
    terminal-store.ts     # Open terminals, PTY state, output buffers
    canvas-store.ts       # Widget positions, viewport, containers, undo stack
    device-store.ts       # Peers, presence, connection status
    notification-store.ts # Notification queue, unread count, approval pending
    ui-store.ts           # Active panel, modal state, command palette, focus
    index.ts
  package.json
  tsconfig.json
```

### @vibe-ctl/protocol

tRPC router definitions. Shared between main process (server) and renderer (client).

```
packages/protocol/
  src/
    router.ts             # Root appRouter = mergeRouters(...)
    routers/
      agent.ts            # list, get, search, onEvent, approve, deny
      terminal.ts         # list, create, kill, resize, onOutput
      canvas.ts           # getState, saveState, addWidget, moveWidget
      device.ts           # peers, localInfo, onPeerChange, ping
      notification.ts     # list, markRead, onNotification
      system.ts           # health, settings, getSettings, updateSettings
    context.ts            # AppContext: { agentService, terminalService, ... }
    index.ts
  package.json
  tsconfig.json
```

### @vibe-ctl/widgets

Canvas widget components. Each widget has breakpoint-aware rendering.

```
packages/widgets/
  src/
    registry.ts           # Widget type registry + WidgetDef[]
    widgets/
      agent-card/
        AgentCard.tsx           # normal/expanded view
        AgentCardCompact.tsx    # compact view
        AgentCardMicro.tsx      # micro view (dot)
        index.ts
      terminal/
        TerminalWidget.tsx      # Full terminal (xterm-r3f)
        TerminalPlaceholder.tsx # Low-zoom placeholder
        terminal-pool.ts        # Instance pool manager
        index.ts
      project-board/
        ProjectBoard.tsx
        index.ts
      notification-stream/
        NotificationStream.tsx
        index.ts
      agent-chat/
        AgentChat.tsx
        index.ts
      device-status/
        DeviceStatus.tsx
        index.ts
    index.ts
  package.json
  tsconfig.json
```

### @vibe-ctl/ui

Shared React components and hooks. Not canvas-specific.

```
packages/ui/
  src/
    components/
      StatusBadge.tsx
      AgentIcon.tsx
      DeviceIcon.tsx
      Toolbar.tsx
      CommandPalette.tsx
      SearchInput.tsx
      ...
    hooks/
      use-trpc.ts          # Typed tRPC hooks
      use-device.ts        # Current device info
      use-keyboard.ts      # Keyboard shortcuts
      ...
    index.ts
  package.json
  tsconfig.json
```

## 4. Build System

### Turborepo Pipeline (`turbo.json`)

```jsonc
{
  "$schema": "https://turbo.build/schema.json",
  "tasks": {
    "build": {
      "dependsOn": ["^build"],
      "outputs": ["dist/**"]
    },
    "dev": {
      "dependsOn": ["^build"],
      "cache": false,
      "persistent": true
    },
    "typecheck": {
      "dependsOn": ["^build"]
    },
    "lint": {},
    "test": {
      "dependsOn": ["^build"]
    }
  }
}
```

### Package Builds

| Package | Build Tool | Output |
|---|---|---|
| shared | tsc (declarations only) | dist/*.d.ts + dist/*.js |
| store | tsc | dist/*.js + dist/*.d.ts |
| protocol | tsc | dist/*.js + dist/*.d.ts |
| ui | tsup (ESM + CJS) | dist/index.js + dist/index.d.ts |
| widgets | tsup (ESM + CJS) | dist/index.js + dist/index.d.ts |
| desktop | electron-vite | dist/main + dist/preload + dist/renderer |

### electron-vite Configuration

```typescript
// apps/desktop/electron-vite.config.ts
import { defineConfig, externalizeDepsPlugin } from 'electron-vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  main: {
    plugins: [externalizeDepsPlugin()],
    build: { rollupOptions: { external: ['better-sqlite3', '@vibecook/truffle'] } },
  },
  preload: {
    plugins: [externalizeDepsPlugin()],
  },
  renderer: {
    plugins: [react(), tailwindcss()],
    resolve: { alias: { '@': '/src/renderer' } },
  },
});
```

## 5. Module Consumption Strategy

### Decision: npm packages + pnpm overrides for version alignment

The existing modules are consumed as **npm packages** (not git submodules,
not workspace members). This keeps them independent and avoids monorepo bloat.

```jsonc
// apps/desktop/package.json
{
  "dependencies": {
    "@vibecook/truffle": "^0.4.0",
    "@vibecook/spaghetti-core": "^0.4.0",
    "@avocado/core": "^0.1.0",
    "@avocado/node-pty": "^0.1.0",
    "@avocado/transport-ipc": "^0.1.0",
    "@avocado/transport-truffle": "^0.1.0",
    "@avocado/react": "^0.1.0",
    "@jamesyong42/infinite-canvas": "^0.0.1",
    "xterm-r3f": "^0.1.0",
    "r3f-msdf": "^0.1.0"
  }
}
```

For modules not yet published to npm, use workspace links during development:

```jsonc
// pnpm-workspace.yaml (temporary, during active co-development)
packages:
  - 'packages/*'
  - 'apps/*'
  - '../p008/truffle/crates/truffle-napi'     # if needed
  - '../p008/spaghetti/packages/core'         # if needed
```

### Version Alignment

Use pnpm `overrides` in root package.json to pin shared peer deps:

```jsonc
{
  "pnpm": {
    "overrides": {
      "react": "19.2.5",
      "react-dom": "19.2.5",
      "three": "0.183.2",
      "@react-three/fiber": "9.5.0"
    }
  }
}
```

## 6. Dev Environment

### Prerequisites

```bash
nvm use 24                  # Node.js 24.x
corepack enable             # Enable pnpm via corepack
pnpm --version              # Verify 10.x
```

### Commands

```bash
pnpm install                # Install all dependencies
pnpm dev                    # Start electron-vite dev server with HMR
pnpm build                  # Build all packages + desktop app
pnpm package                # Create distributable
pnpm typecheck              # Type-check all packages
pnpm lint                   # Lint all packages
pnpm test                   # Test all packages
pnpm --filter @vibe-ctl/widgets dev   # Dev single package
```

### TypeScript Project References

Root `tsconfig.json` references all packages. Each package extends a shared
base from `tooling/tsconfig/`.

```jsonc
// tsconfig.json (root)
{
  "references": [
    { "path": "packages/shared" },
    { "path": "packages/store" },
    { "path": "packages/protocol" },
    { "path": "packages/ui" },
    { "path": "packages/widgets" }
  ]
}
```

## 7. Native Module Handling

### Truffle (`@vibecook/truffle`)

- Ships prebuilt NAPI-RS binaries (darwin-arm64, darwin-x64, linux-x64, win32-x64)
- Also ships a Go sidecar binary
- Needs `electron-rebuild` to ensure ABI compatibility with Electron's Node
- Add to `electron-builder.yml` `extraResources` for sidecar binary

### Avocado (`@avocado/node-pty`)

- Wraps `node-pty` which needs native compilation
- `electron-rebuild` handles this
- Already listed in pnpm `onlyBuiltDependencies`

### better-sqlite3 (via spaghetti)

- Native module, needs `electron-rebuild`
- Well-tested with Electron, no issues expected

### electron-rebuild Config

```jsonc
// apps/desktop/package.json
{
  "scripts": {
    "postinstall": "electron-rebuild"
  }
}
```

---

## Open Questions

- [ ] Should `tooling/` configs be a separate workspace package (e.g., `@vibe-ctl/tsconfig`)?
- [ ] Biome vs ESLint+Prettier for linting/formatting? (infinite-canvas uses Biome)
- [ ] Should we use Vite library mode or tsup for shared packages? (tsup is simpler, Vite is more flexible)
- [ ] Is `electron-rebuild` sufficient for truffle's NAPI binaries, or do we need custom prebuild logic?
