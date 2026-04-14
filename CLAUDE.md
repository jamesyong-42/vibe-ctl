# vibe-ctl — AI dev instructions

Cross-platform AI agent control center. Architecture: minimal kernel +
plugins. First-party plugins use the same public API as third-party.

## Read these first

1. **`docs/specs/00-overview.md`** — vision, architecture, decisions
2. **`docs/specs/01-extension-system.md`** — plugin contract (the public API)
3. **`docs/specs/02-kernel-runtime.md`** — kernel internals + sync model
4. **`docs/specs/03-monorepo-layout.md`** — file tree, package boundaries
5. **`docs/specs/04-registry-marketplace.md`** — distribution model

Outdated specs are in `docs/specs/outdated/`. Do not use them as source of truth.

## Packages

| Path | Purpose |
|---|---|
| `core/extension-api` | Published to npm. Plugin contract (types + `Plugin` base class). |
| `core/runtime` | Plugin host + sync fabric. Owns the single `NapiNode` and kernel ECS world. |
| `core/canvas` | Canvas substrate + CRDT sync adapter + `ctx.ui` primitives. |
| `core/shell` | Electron shell (main / preload / renderer chrome). |
| `plugins/*` | First-party plugins (T1), bundled into the app. |
| `apps/desktop` | Electron packaging + resources. |
| `tooling/tsconfig` | Shared tsconfig presets (published). |
| `tooling/tsup-plugin-preset` | Shared tsup config for plugins (externals + asset copying). |
| `tooling/create-vibe-plugin` | Plugin scaffold CLI. |
| `tooling/plugin-registry-tools` | Registry PR CLI. |

## Conventions

- **Node 24** (see `.node-version`).
- **pnpm 10 workspaces**; internal deps use `workspace:*`.
- **TypeScript 5.7+** strict mode. `verbatimModuleSyntax` is on — always
  use `import type` for type-only imports and `.js` extensions in relative
  imports.
- **Biome** for lint + format + import sorting. Runs automatically on pre-commit.
- **tsup** for library builds (emits ESM + `.d.ts`). Plugins bundle ESM
  only (no `.d.ts` — plugins are consumed, not imported as types).
- **electron-vite** for the Electron shell (HMR across main/preload/renderer).
- **Host-provided singletons** (managed by `@vibe-ctl/tsup-plugin-preset`):
  `@vibe-ctl/extension-api`, `react`, `react-dom`,
  `@jamesyong42/infinite-canvas`, `@jamesyong42/reactive-ecs`,
  `@vibecook/truffle`. Plugins never bundle their own copies of these.
  Use `definePluginConfig()` from the preset — do not inline the external list.

## Scripts

```bash
pnpm dev          # all packages in watch mode + Electron dev
pnpm build        # build everything (turbo; cached)
pnpm package      # electron-builder (requires prior build)
pnpm lint         # Biome check (read-only)
pnpm lint:fix     # Biome check --write (auto-fix)
pnpm format       # Biome format --write
pnpm typecheck    # tsc --noEmit across all packages
pnpm test         # vitest run (workspace-wide)
pnpm clean        # turbo run clean (all packages)
pnpm changeset    # create a changeset for versioning
pnpm create-plugin <name>   # scaffold a new first-party plugin
```

## Slash commands

- `/verify` — runs install + build + typecheck + lint end-to-end; reports failures without auto-fixing
- `/new-plugin <name>` — scaffolds a new first-party plugin (reads specs first)
- `/spec-check` — cross-checks scaffold vs specs; reports drift only, no changes

## Git hooks (husky + lint-staged)

- **pre-commit** — runs Biome on staged files (write-mode). Format + safe
  lint fixes applied automatically. Fails the commit on non-fixable issues.
- **pre-push** — runs `pnpm typecheck` across the workspace. Catches type
  errors before they hit the remote. Cached by turbo so it's fast.

Do NOT bypass hooks (`--no-verify`) unless the user explicitly asks.
If a hook fails, fix the underlying issue rather than skipping.

## Dev loop for a single plugin

```bash
cd plugins/<name>
pnpm dev   # tsup --watch; kernel hot-reloads dist/ changes
```

## External dev plugins (testing community plugins locally)

```bash
cd ~/my-plugin
pnpm build

# Point vibe-ctl at it:
VIBE_CTL_DEV_PLUGINS=~/my-plugin pnpm dev
# Kernel loads it as T3 (community tier) with hot-reload.
```

## Source modules (auto-linked by `.pnpmfile.cjs` when paths exist)

If these local directories exist on disk, pnpm links to them directly for
instant iteration. If they don't exist (CI, fresh clone), pnpm falls back
to the npm registry versions.

| Package | Local path |
|---|---|
| `@vibecook/truffle` | `../p008/truffle/crates/truffle-napi` |
| `@vibecook/spaghetti-sdk` | `../p008/spaghetti/packages/sdk` |
| `@vibecook/avocado-sdk` | `../p008/avocado/packages/sdk` |
| `@jamesyong42/infinite-canvas` | `../infinite-canvas/packages/infinite-canvas` |
| `@jamesyong42/reactive-ecs` | `../reactive-ecs` |

## Before implementing anything

- Re-read the relevant spec section. The specs are authoritative; code
  must follow them, not the other way round.
- When a spec is wrong or incomplete, update the spec first, then write
  the code. Do not silently drift.
- Prefer programmatic registration (`ctx.*.register()`) over manifest
  declarative contribution arrays — spec 01 §1 "Design Rule 1".

## Testing

- **Vitest** is wired as the test framework. Test files go in
  `src/**/*.test.ts` within each package. Run with `pnpm test`.
- The quality bar is `pnpm typecheck && pnpm lint && pnpm build` passing,
  not test coverage.

## CI/CD

- **GitHub Actions** runs on every push to `main` and every PR:
  `pnpm install --frozen-lockfile`, `pnpm lint`, `pnpm typecheck`,
  `pnpm build`, `pnpm test`.
- **Changesets** handles release versioning. Run `pnpm changeset` to
  describe version bumps before merging. The release workflow opens a
  "Version Packages" PR and publishes to npm on merge.
- **Renovate** keeps dependencies up to date with grouped PRs and
  automerge for safe updates.

## What NOT to do

- Do not add fallbacks, retry loops, or defensive code for scenarios the
  kernel already handles.
- Do not add `error handling` or `migration code` at plugin boundaries —
  the kernel owns lifecycle, teardown, and version checking (spec 02).
- Do not bypass `ctx.*` to reach into runtime internals. If the `ctx` API
  is missing something, add it to `core/extension-api` first (with a
  spec change), then expose it in `core/runtime/context-builder.ts`.
- Do not publish `core/*` packages to npm except `@vibe-ctl/extension-api`
  and `@vibe-ctl/tsconfig`. Everything else is `"private": true`.
