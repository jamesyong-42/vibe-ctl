# 03 -- Monorepo Layout

> File tree, package boundaries, build pipeline. Aligned with the three
> kernel layers from spec 02 and the plugin contract from spec 01.

**Depends on:** `00-overview.md`, `01-plugin-system.md`, `02-kernel-runtime.md`

---

## 1. Top-Level Structure

```
vibe-ctl/
├── package.json                        # Root workspace config
├── pnpm-workspace.yaml
├── turbo.json
├── tsconfig.base.json
├── .pnpmfile.cjs                       # Opt-in local linking (VIBE_LINK_LOCAL=1)
├── .node-version                       # 24
├── CLAUDE.md
├── README.md
├── specs/                              # These spec documents
│
├── core/                               # The kernel (private packages)
│   ├── plugin-api/                     # Published to npm
│   ├── runtime/                        # Plugin host + sync fabric
│   ├── canvas/                         # Canvas engine wrapper + CRDT adapter (no UI)
│   ├── ui/                             # Portable React design system (ctx.ui.*)
│   └── shell/                          # Electron shell (renderer + main + preload)
│
├── plugins/                            # First-party plugins (T1)
│   ├── claude-code/
│   ├── terminal/
│   ├── notifications/
│   ├── dynamic-island/
│   ├── project-manager/
│   ├── command-palette/
│   ├── side-panels/
│   ├── themes/
│   ├── mesh-widgets/                   # Device status/proxy widgets
│   └── quick-actions/
│
├── apps/
│   └── desktop/                        # Electron app shell
│
├── tooling/
│   ├── tsconfig/                       # Shared tsconfig presets
│   ├── tsup-plugin-preset/             # Shared tsup preset for plugins
│   ├── create-plugin/                  # @vibe-ctl/create-plugin (scaffolder)
│   └── plugin-cli/                     # @vibe-ctl/plugin-cli (dev CLI)
│
└── e2e/                                # End-to-end tests
```

Note what's NOT here: no `plugins/mesh/`. Truffle/mesh is a kernel
responsibility now (spec 02 §3). `plugins/mesh-widgets/` provides
optional device-status and port-proxy UI widgets that consume the
kernel's mesh capability; the capability itself lives in the kernel.

---

## 2. Workspace Config

### `pnpm-workspace.yaml`

```yaml
packages:
  - 'core/*'
  - 'plugins/*'
  - 'apps/*'
  - 'tooling/*'
```

External modules (truffle, spaghetti-sdk, avocado-sdk, infinite-canvas,
reactive-ecs) are consumed as normal dependencies. `.pnpmfile.cjs`
provides **opt-in** local linking: set `VIBE_LINK_LOCAL=1` before
`pnpm install` to link to sibling checkouts; default install and CI
resolve from npm so the committed lockfile stays portable.

### `.pnpmfile.cjs`

```js
const fs = require('fs');
const path = require('path');

const LOCAL_MODULES = {
  '@vibecook/truffle':            '../p008/truffle/crates/truffle-napi',
  '@vibecook/spaghetti-sdk':      '../p008/spaghetti/packages/sdk',
  '@vibecook/avocado-sdk':        '../p008/avocado/packages/sdk',
  '@jamesyong42/infinite-canvas': '../infinite-canvas/packages/infinite-canvas',
  '@jamesyong42/reactive-ecs':    '../reactive-ecs',
};

function readPackage(pkg) {
  if (!process.env.VIBE_LINK_LOCAL) return pkg;
  for (const [name, localPath] of Object.entries(LOCAL_MODULES)) {
    const absPath = path.resolve(__dirname, localPath);
    if (!fs.existsSync(absPath)) continue;
    if (pkg.dependencies?.[name])    pkg.dependencies[name]    = `link:${absPath}`;
    if (pkg.devDependencies?.[name]) pkg.devDependencies[name] = `link:${absPath}`;
  }
  return pkg;
}

module.exports = { hooks: { readPackage } };
```

### Root `package.json`

```jsonc
{
  "name": "vibe-ctl-monorepo",
  "private": true,
  "packageManager": "pnpm@10.33.0",
  "engines": { "node": ">=24" },
  "scripts": {
    "dev": "turbo run dev",
    "build": "turbo run build",
    "package": "turbo run package --filter=@vibe-ctl/desktop",
    "typecheck": "turbo run typecheck",
    "lint": "turbo run lint",
    "test": "turbo run test",
    "create-plugin": "npx @vibe-ctl/create-plugin"
  },
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

### `turbo.json`

```jsonc
{
  "$schema": "https://turbo.build/schema.json",
  "tasks": {
    "build":     { "dependsOn": ["^build"], "outputs": ["dist/**"] },
    "dev":       { "dependsOn": ["^build"], "cache": false, "persistent": true },
    "typecheck": { "dependsOn": ["^build"] },
    "lint":      {},
    "test":      { "dependsOn": ["^build"] },
    "bundle-plugins": {
      "dependsOn": ["build"],
      "outputs": ["../../apps/desktop/resources/plugins/**"]
    },
    "package": {
      "dependsOn": ["bundle-plugins", "^build"],
      "outputs": ["release/**"]
    }
  }
}
```

---

## 3. Core Packages

### `core/plugin-api/` -- `@vibe-ctl/plugin-api` (PUBLISHED)

The plugin author's contract. Everything in spec 01. Published to npm so
third-party plugin authors `npm install` it.

```
core/plugin-api/
├── package.json
├── tsup.config.ts
└── src/
    ├── index.ts                        # Public re-exports
    ├── plugin.ts                       # abstract class Plugin
    ├── context.ts                      # PluginContext interface
    ├── manifest-schema.ts              # Zod schema
    ├── events.ts                       # VibeEvents (declaration-merge target)
    ├── widgets.ts                      # WidgetDef, WidgetPlacement
    ├── commands.ts                     # CommandDef
    ├── services/
    │   ├── registry.ts
    │   ├── proxy.ts
    │   └── errors.ts
    ├── sync.ts                         # ctx.sync types (CrdtDoc, SyncedStore refs)
    ├── ui.ts                           # ctx.ui primitive components (types only)
    ├── permissions.ts
    ├── disposable.ts
    └── types.ts
```

**Dependencies (runtime):**
- `zod`, `semver`

Runtime types for `CrdtDoc` / `SyncedStore` are re-exported from
`@vibecook/truffle`; the ACTUAL instances are host-provided at runtime.

### `core/runtime/` -- `@vibe-ctl/runtime` (PRIVATE)

The plugin host + sync fabric. Implements everything in spec 02.

```
core/runtime/
├── package.json
├── src/
│   ├── index.ts                        # export { Runtime }
│   ├── runtime.ts                      # Main Runtime class (boot/stop)
│   │
│   ├── sync/                           # Sync Fabric (Layer 2 of spec 02)
│   │   ├── mesh-node.ts                # Single NapiNode owner
│   │   ├── kernel-docs.ts              # The four kernel-managed docs
│   │   ├── version-gate.ts             # minKernelVersion check
│   │   └── offline-mode.ts
│   │
│   ├── plugin-host/                    # Plugin Host (Layer 3 of spec 02)
│   │   ├── discovery.ts
│   │   ├── resolver.ts                 # DependencyResolver
│   │   ├── activation.ts
│   │   ├── deactivation.ts
│   │   ├── disposable-tracker.ts
│   │   ├── context-builder.ts
│   │   ├── hot-reloader.ts
│   │   └── module-resolver/            # Host-provided package resolution
│   │       ├── install.ts
│   │       └── import-map.ts
│   │
│   ├── service-registry.ts
│   ├── command-registry.ts
│   ├── settings-manager.ts
│   ├── permission-manager.ts
│   ├── health-system.ts
│   │
│   └── ecs/                            # Kernel ECS world (internal)
│       ├── world.ts                    # createKernelWorld()
│       ├── components.ts               # PluginManifest, PluginState, ...
│       ├── tags.ts
│       └── systems.ts                  # DiscoverySystem, ActivationSystem, ...
```

**Dependencies:**
- `@vibe-ctl/plugin-api` (workspace)
- `@jamesyong42/reactive-ecs` (ECS for kernel world)
- `@vibecook/truffle` (mesh + CrdtDoc + SyncedStore)
- `zod`, `semver`, `chokidar`

### `core/canvas/` -- `@vibe-ctl/canvas` (PRIVATE)

Thin wrapper around `@jamesyong42/infinite-canvas` that adds
kernel-specific concerns: the engine, the canvas-sync adapter, and the
widget-type registry. Zero UI components — this package does NOT render.

```
core/canvas/
├── package.json
└── src/
    ├── index.ts                        # Re-exports the three exports below
    ├── engine.ts                       # Kernel-aware engine wrapper
    ├── widget-type-registry.ts         # Reactive; mirrors to kernel ECS
    └── canvas-sync-adapter.ts          # The canvas ECS ↔ Loro bridge (spec 02 §4.2)
```

**Dependencies:**
- `@jamesyong42/infinite-canvas` (peer — engine + ECS)
- `@jamesyong42/reactive-ecs` (peer — ECS runtime)
- `@vibecook/truffle` (peer — CrdtDoc types)
- `@vibe-ctl/plugin-api` (workspace)

No React peer dep. The package is renderer-agnostic — runs in an
electron renderer, a web renderer, node tests, whatever the host is.

### `core/ui/` -- `@vibe-ctl/ui` (PRIVATE)

The portable design system: `ctx.ui.*` primitives, icons, layout slots,
missing-plugin placeholder. Pure React — no Electron, no canvas engine,
no truffle. Consumed by any renderer (desktop shell today, web shell
tomorrow, storybook/tests at any point).

```
core/ui/
├── package.json
└── src/
    ├── index.ts                        # Public re-exports
    ├── primitives/                     # ctx.ui implementations
    │   ├── Badge.tsx
    │   ├── Button.tsx
    │   ├── FloatingButton.tsx          # Round FAB primitive used by every shell
    │   ├── Icon.tsx
    │   ├── Input.tsx
    │   ├── List.tsx
    │   ├── ListItem.tsx
    │   ├── Modal.tsx
    │   ├── Panel.tsx
    │   ├── Select.tsx
    │   ├── Separator.tsx
    │   ├── Spinner.tsx
    │   ├── Tooltip.tsx
    │   └── index.ts                    # Exports + the `ui: UI` bundle
    ├── icons/                          # One-per-file SVG icon catalog
    │   ├── BackIcon.tsx
    │   ├── ChevronIcon.tsx
    │   ├── InspectorIcon.tsx
    │   ├── MoonIcon.tsx
    │   ├── SettingsIcon.tsx
    │   └── SunIcon.tsx
    ├── layout/                         # Slot components (where widgets mount)
    │   ├── SidePanelSlot.tsx
    │   ├── StatusBarSlot.tsx
    │   ├── CommandPaletteSlot.tsx
    │   └── NotificationSurfaceSlot.tsx
    └── placeholders/
        └── MissingPluginPlaceholder.tsx
```

**Dependencies:**
- `react`, `react-dom` (peer)
- `@vibe-ctl/plugin-api` (workspace — for `UI` / prop types)

The canvas-mount placement (which needs an engine instance) is NOT here
— it lives in `core/shell/src/renderer/screens/main/workspace/` because
it couples to the engine construction site.

### `core/shell/` -- `@vibe-ctl/shell` (PRIVATE)

Electron shell. Main + preload processes, plus a screens-first renderer
that composes `@vibe-ctl/ui` primitives + `@vibe-ctl/canvas` engine into
the desktop app's user-facing screens. Electron-only; a future
`core/web-shell/` would mirror this layout for a browser build.

```
core/shell/
├── package.json
├── electron.vite.config.ts
├── scripts/
│   └── build-preload.mjs               # CJS preload companion (see memory)
└── src/
    ├── main/                           # Electron main process
    │   ├── index.ts
    │   ├── windows.ts
    │   ├── tray.ts
    │   ├── menu.ts
    │   ├── protocol.ts
    │   ├── security.ts
    │   ├── navigation.ts
    │   ├── auto-updater.ts
    │   └── utility-process-host.ts
    │
    ├── preload/
    │   └── index.ts
    │
    └── renderer/
        ├── index.html
        ├── entry.client.tsx            # Mount React: side-effects → providers → <Root/>
        │
        ├── app/                        # Cross-screen composition + bootstrap
        │   ├── root.tsx                # Renders active screen
        │   ├── boot.ts                 # Orchestrates startup tasks
        │   ├── providers.tsx           # Stacks global providers
        │   ├── screen-router.tsx       # State machine between screens
        │   ├── useScreenState.ts
        │   └── theme/
        │       ├── ThemeProvider.tsx
        │       └── useTheme.ts
        │
        ├── chrome/                     # Window-level Electron primitives
        │   └── DragRegion.tsx          # -webkit-app-region strip
        │
        ├── screens/                    # PRIMARY organizational axis
        │   ├── loading/                # Plugin loading + update checks
        │   │   ├── LoadingScreen.tsx
        │   │   ├── ProgressBar.tsx
        │   │   ├── TaskList.tsx
        │   │   └── useBootTasks.ts
        │   ├── onboarding/             # First-use welcome flow
        │   │   ├── OnboardingScreen.tsx
        │   │   ├── useOnboardingProgress.ts
        │   │   └── steps/
        │   ├── version-gate/           # Blocking "update required" screen
        │   │   └── VersionGateScreen.tsx
        │   └── main/                   # The canvas experience — 3 layers + overlays
        │       ├── MainScreen.tsx
        │       ├── workspace/          # LAYER 1 — infinite canvas substrate
        │       │   ├── WorkspaceLayer.tsx
        │       │   ├── EngineProvider.tsx
        │       │   ├── useEngine.ts
        │       │   └── useWorkspaceShortcuts.ts
        │       ├── hud/                # LAYER 2 — heads-up display (floating UI + dock)
        │       │   ├── HudLayer.tsx
        │       │   ├── navigation/
        │       │   │   ├── NavigationBar.tsx
        │       │   │   ├── BackButton.tsx
        │       │   │   ├── Breadcrumbs.tsx
        │       │   │   └── useNavigationCrumbs.ts
        │       │   ├── theme-toggle/
        │       │   │   └── ThemeToggleButton.tsx
        │       │   ├── settings/
        │       │   │   ├── SettingsButton.tsx
        │       │   │   └── SettingsPanel.tsx
        │       │   ├── inspector/
        │       │   │   ├── InspectorButton.tsx
        │       │   │   └── InspectorPanel.tsx
        │       │   └── dock/           # Figma toolbar / macOS dock — launches overlays
        │       │       ├── Dock.tsx
        │       │       ├── DockItem.tsx
        │       │       └── useDock.ts
        │       ├── dynamic-island/     # LAYER 3 — macOS notch widget
        │       │   ├── DynamicIslandLayer.tsx
        │       │   └── useDynamicIsland.ts
        │       └── overlays/           # Full-screen overlays triggered from dock
        │           ├── OverlayHost.tsx
        │           ├── registry.ts
        │           └── agents-monitor/
        │               └── AgentsMonitorOverlay.tsx
        │
        └── styles/
            └── index.css               # Tailwind v4 entry + design tokens
```

**Dependencies:**
- `@vibe-ctl/runtime` (workspace)
- `@vibe-ctl/canvas` (workspace)
- `@vibe-ctl/ui` (workspace)
- `@vibe-ctl/plugin-api` (workspace)
- `electron`, `electron-updater`

### Renderer file-naming conventions

| Role | Suffix | Example |
|---|---|---|
| Screen entry | `*Screen.tsx` | `LoadingScreen.tsx`, `MainScreen.tsx` |
| Layer entry | `*Layer.tsx` | `WorkspaceLayer.tsx`, `HudLayer.tsx` |
| Overlay entry | `*Overlay.tsx` | `AgentsMonitorOverlay.tsx` |
| Host / frame | `*Host.tsx` | `OverlayHost.tsx` |
| UI region | `*Bar.tsx`, `*Panel.tsx`, `*Button.tsx` | `NavigationBar.tsx` |
| Hook | `use<Name>.ts` | `useEngine.ts`, `useDock.ts` |
| Provider | `*Provider.tsx` | `EngineProvider.tsx` |

Folders are kebab-case, singular (`workspace/`, `theme-toggle/`,
`version-gate/`). Files are PascalCase `.tsx` for components,
camelCase `.ts` for hooks / pure modules.

---

## 4. Host-Provided Packages

These are singletons injected into plugins at load time. Plugin authors
mark them `external` in their bundler config (see §5).

| Package | Role |
|---|---|
| `@vibe-ctl/plugin-api` | The plugin contract itself |
| `react`, `react-dom` | UI primitives consistent across plugins |
| `@jamesyong42/infinite-canvas` | Canvas engine (shared ECS world) |
| `@jamesyong42/reactive-ecs` | ECS library (shared runtime) |
| `@vibecook/truffle` | `CrdtDoc` / `SyncedStore` types (instances come from host) |

The host bundles `@vibe-ctl/ui` and exposes its primitives to every plugin
through `ctx.ui` at runtime. Plugins do NOT import `@vibe-ctl/ui` directly
— that path stays internal to whichever shell is hosting them, so the
same plugin renders identically in the desktop shell, a future web
shell, or a test harness.

Plugins that bundle their own copy of these fail validation at load
time (see spec 02 §8).

---

## 5. First-Party Plugin Package Template

Every plugin in `plugins/` follows the same layout — identical to any
third-party plugin. This is the dogfooding boundary.

### File tree

```
plugins/claude-code/
├── package.json
├── plugin.json                         # Manifest (spec 01 §2)
├── tsup.config.ts
├── src/
│   ├── main.ts                         # utilityProcess half (for split plugin)
│   ├── renderer.ts                     # renderer half
│   ├── services/
│   ├── widgets/
│   └── settings.ts
├── assets/
│   └── icon.svg
└── dist/
    ├── plugin.json                     # Copied verbatim
    ├── main.js
    ├── renderer.js
    └── assets/
```

### `package.json`

```jsonc
{
  "name": "@vibe-ctl/plugin-claude-code",
  "version": "1.0.0",
  "private": true,
  "type": "module",
  "scripts": {
    "build": "tsup && cp plugin.json dist/ && cp -r assets dist/",
    "dev": "tsup --watch"
  },
  "dependencies": {
    "@vibecook/spaghetti-sdk": "^0.5.1"
  },
  "peerDependencies": {
    "@vibe-ctl/plugin-api": "^1.0.0",
    "react": "^19.0.0",
    "@vibecook/truffle": "^0.4.2",
    "@jamesyong42/reactive-ecs": "^0.1.0"
  },
  "devDependencies": {
    "@vibe-ctl/tsconfig": "workspace:*",
    "tsup": "^8.0.0"
  }
}
```

### `tsup.config.ts`

```typescript
import { defineConfig } from 'tsup';

export default defineConfig({
  entry: { main: 'src/main.ts', renderer: 'src/renderer.ts' },
  format: ['esm'],
  target: 'es2022',
  clean: true,
  sourcemap: true,
  dts: false,
  external: [
    '@vibe-ctl/plugin-api',
    'react',
    'react-dom',
    '@jamesyong42/infinite-canvas',
    '@jamesyong42/reactive-ecs',
    '@vibecook/truffle',
  ],
});
```

---

## 6. Built-in Plugin Catalogue

Updated to reflect mesh-in-kernel.

| Plugin | Tier | Provides | Requires | Purpose |
|---|---|---|---|---|
| `@vibe-ctl/plugin-claude-code` | T1 | `agents.raw`, `agents` | — | Spaghetti session discovery, channel, hook events |
| `@vibe-ctl/plugin-terminal` | T1 | `terminal.pty`, `terminal` | — | Avocado PTY + mesh terminal sync (uses kernel mesh) |
| `@vibe-ctl/plugin-notifications` | T1 | `notifications` | `agents` | Approval flow, OS notifications |
| `@vibe-ctl/plugin-dynamic-island` | T1 | — | `notifications`, `agents` | Swift helper, macOS only |
| `@vibe-ctl/plugin-project-manager` | T1 | `projects` | `agents` | Project tree, grouping by directory |
| `@vibe-ctl/plugin-command-palette` | T1 | — | — | Cmd+K palette UI |
| `@vibe-ctl/plugin-side-panels` | T1 | — | `projects`, `agents` | Project nav, agent list, search |
| `@vibe-ctl/plugin-themes` | T1 | `themes` | — | Theme contributions |
| `@vibe-ctl/plugin-mesh-widgets` | T1 | — | — | Device status, shared-services widgets |
| `@vibe-ctl/plugin-quick-actions` | T1 | — | `agents`, `terminal` | Common action widgets |

Each plugin has one responsibility. Disable any in Settings → Plugins
and the app still works (diminished).

---

## 7. Desktop App

```
apps/desktop/
├── package.json
├── electron-vite.config.ts
├── electron-builder.yml
├── src/
│   └── index.ts                        # Re-export @vibe-ctl/shell
├── resources/                          # Bundled into final app
│   ├── icons/
│   ├── plugins/                        # Populated at build by bundle-plugins task
│   └── NotchHelper/                    # Swift binary (macOS)
└── release/                            # electron-builder output
    ├── vibe-ctl-0.1.0.dmg
    ├── vibe-ctl-Setup-0.1.0.exe
    └── vibe-ctl-0.1.0.AppImage
```

### Plugin bundling

The turbo `bundle-plugins` task runs after all plugin `build` tasks,
before `package`. It copies each `plugins/*/dist/` into
`apps/desktop/resources/plugins/{plugin-id}/` so electron-builder
picks them up via `extraResources`.

---

## 8. Dev Workflow

### Full-stack

```bash
nvm use 24
pnpm install
pnpm build                 # Once
pnpm dev                   # All packages in watch mode + Electron dev
```

Kernel hot-reloads any plugin when its `dist/` changes. Only core
package changes require full app restart.

### Single plugin

```bash
cd plugins/claude-code
pnpm dev                   # Just this plugin's tsup --watch
# Main dev server already running; plugin hot-reloads
```

### External community plugin

```bash
cd ~/my-plugin
pnpm build

# Point vibe-ctl at it:
VIBE_CTL_DEV_PLUGINS=~/my-plugin pnpm dev
# Loaded as T3, with hot reload
```

---

## 9. Build Pipeline

```
pnpm build
    ↓
turbo run build (respects dep graph)
    ↓
┌────────────────────────────────────────────────────┐
│ core/plugin-api  (no deps)                          │
│     ↓                                                │
│ core/runtime  +  core/canvas  +  core/ui             │
│     ↓                                                │
│ core/shell                                           │
│     ↓                                                │
│ plugins/* (parallel; all depend on plugin-api)      │
└────────────────────────────────────────────────────┘
    ↓
turbo run bundle-plugins
    (copies plugins/*/dist → apps/desktop/resources/plugins/)
    ↓
turbo run package (electron-builder)
    ↓
release/*.dmg, *.exe, *.AppImage
```

Content-hashed cache: changing a single plugin rebuilds only that
plugin + the bundle-plugins task. CI is fast on unchanged paths.

---

## 10. Tooling

### `tooling/tsconfig/` (`@vibe-ctl/tsconfig`)

```
tooling/tsconfig/
├── package.json
├── base.json                           # Shared base options
├── library.json                        # For packages that emit .d.ts
├── plugin.json                         # For plugins (no emit, bundled)
├── electron-main.json
└── electron-renderer.json
```

Published to npm alongside `@vibe-ctl/create-plugin` so third-party plugin
authors extend the same presets.

### `tooling/create-plugin/`

Published as `@vibe-ctl/create-plugin`. Scaffolds a new plugin with
manifest, bundler config, tsconfig, and an empty `Plugin` subclass:

```bash
npx @vibe-ctl/create-plugin my-plugin
cd my-plugin
pnpm install
pnpm dev
```

Scaffolds both a single-entry and split-plugin skeleton based on a
prompt at scaffold time.

### `tooling/plugin-cli/`

Published as `@vibe-ctl/plugin-cli`. CLI that helps
third-party authors submit to the registry (see spec 04).

---

## 11. Placement Guidelines

**Kernel (`core/*`):**
- `plugin-api`: the contract — types only, no impl
- `runtime`: plugin host + sync fabric (truffle, ECS world)
- `canvas`: engine wrapper + CRDT adapter + widget-type registry
- `ui`: portable React primitives + icons + layout slots + placeholders
- `shell`: Electron-only — main/preload/renderer composition
- No domain logic anywhere in `core/`

**Plugin (`plugins/*`):**
- All domain logic (agents, terminals, notifications, dynamic island)
- All widgets (canvas items, side panels, status items)
- All third-party SDK integrations (spaghetti-sdk, avocado-sdk, etc.)

**Desktop app (`apps/desktop`):**
- Electron packaging + resources
- Nothing else

**The shape test:**
- Component depends only on React → `core/ui`
- Component depends on canvas engine → `core/shell` (or future web-shell)
- Component is Electron-specific (uses `-webkit-app-region`, IPC, etc.)
  → `core/shell/src/renderer/chrome/`
- Component touches a domain (agents, terminals, settings semantics) →
  a plugin

Writing agent-specific code in `core/` → move to a plugin. Writing a
React component in `core/canvas` → move to `core/ui` or to the shell.
Writing shared infra inside a plugin → lift into `core/plugin-api`.

---

## Decisions

- **Publish `@vibe-ctl/tsconfig` to npm.** Third-party plugin authors
  extend the same tsconfig presets as first-party plugins. One-package
  maintenance cost for monorepo-wide consistency.
- **First-party plugins: lockstep versioning with the app.** Simpler for
  users (one version number). All first-party plugins bumped together
  each release. No Changesets.
- **Biome for linting + formatting.** reactive-ecs and infinite-canvas
  already use it. Single config. Faster. Ecosystem consistency.
- **Plugin bundling via turbo task** (explicit copy to
  `apps/desktop/resources/plugins/`). Cacheable, inspectable, debuggable.
  electron-builder's `extraResources` glob is opaque when something's
  missing.
- **`@vibe-ctl/plugin-api` exports UI primitive types only; components
  provided at runtime via `ctx.ui`.** Keeps the API package small (no
  React dep for authors using only types). Host versions components
  without breaking plugins.
- **`core/canvas` is renderer-agnostic.** Engine wrapper, CRDT adapter,
  widget-type registry. No React peer dep. Runs in any host (electron
  shell, future web shell, node tests). UI primitives that previously
  shipped here moved to `core/ui` for portability.
- **`core/ui` is the portable design system.** Pure React. No Electron,
  no canvas, no truffle. Houses the `ctx.ui.*` primitives, icon
  catalog, layout slots, and `MissingPluginPlaceholder`. Consumed by
  whatever shell is hosting (desktop today, web tomorrow). Plugins
  reach these via `ctx.ui` at runtime — never imported directly.
- **Electron-specific renderer code lives under `core/shell/src/renderer/chrome/`.**
  Anything that uses `-webkit-app-region`, IPC, native window APIs, or
  Electron-specific behaviors stays out of `core/ui`. Future web shell
  has its own equivalent of `chrome/` (or none) without polluting the
  shared design system.
- **Renderer is screens-first.** Top axis = screen state machine
  (`loading` → `onboarding` → `version-gate` → `main`). Inside `main`,
  three layers stacked by z-index (`workspace`, `hud`, `dynamic-island`)
  plus full-screen `overlays` triggered from the dock. Cross-screen
  concerns (theme, engine providers) live in `app/`. Mirrors how users
  experience the app instead of forcing every component into one flat
  features bucket.
- **Widgets are plugin territory.** No `widgets/` folder anywhere in
  `core/`. The shell renders an empty workspace until plugins activate
  and contribute. Debug/dev widgets ship as a first-party plugin, not
  embedded in the shell source.
