# vibe-ctl — AI dev instructions

Cross-platform AI agent control center. Architecture: minimal kernel +
plugins. Read `specs/00-overview.md` first, then drill into 01–04.

## Packages

| Path | Purpose |
|---|---|
| `core/extension-api` | Published to npm. Plugin contract (types + base class). |
| `core/runtime` | Plugin host + sync fabric (truffle wrapper). |
| `core/canvas` | Canvas substrate + CRDT sync adapter + UI primitives. |
| `core/shell` | Electron shell (main / preload / renderer chrome). |
| `plugins/*` | First-party plugins (T1), bundled into the app. |
| `apps/desktop` | Electron packaging + resources. |
| `tooling/*` | Shared tsconfig, Biome config, CLIs. |

## Conventions

- **Node 24** (see `.node-version`).
- **pnpm 10 workspaces**; internal deps use `workspace:*`.
- **TypeScript 5.7+** with strict mode.
- **Biome** for lint + format. Run `pnpm lint:fix` before committing.
- **tsup** for library builds (emits ESM + .d.ts). Plugins bundle ESM only
  (no .d.ts — plugins are consumed, not imported as types).
- **electron-vite** for the Electron shell (HMR across main/preload/renderer).
- **Host-provided singletons** (marked `external` in every plugin's tsup
  config): `@vibe-ctl/extension-api`, `react`, `react-dom`,
  `@jamesyong42/infinite-canvas`, `@jamesyong42/reactive-ecs`,
  `@vibecook/truffle`.

## Scripts

```bash
pnpm dev          # all packages in watch mode + Electron dev
pnpm build        # build everything
pnpm package      # electron-builder (requires prior build)
pnpm lint         # Biome check
pnpm format       # Biome format-write
pnpm typecheck    # all packages
```

## Dev loop for a single plugin

```bash
cd plugins/<name>
pnpm dev   # tsup --watch; kernel hot-reloads dist/ changes
```

## External dev plugins (testing community plugins locally)

```bash
cd ~/my-plugin
pnpm build
# point vibe-ctl at it:
VIBE_CTL_DEV_PLUGINS=~/my-plugin pnpm dev
# kernel loads it as T3 with hot-reload
```

## Source modules (auto-linked by `.pnpmfile.cjs` when paths exist)

| Package | Local path |
|---|---|
| `@vibecook/truffle` | `../p008/truffle/crates/truffle-napi` |
| `@vibecook/spaghetti-sdk` | `../p008/spaghetti/packages/sdk` |
| `@vibecook/avocado-sdk` | `../p008/avocado/packages/sdk` |
| `@jamesyong42/infinite-canvas` | `../infinite-canvas/packages/infinite-canvas` |
| `@jamesyong42/reactive-ecs` | `../reactive-ecs` |
