# @vibe-ctl/extension-api

The public plugin contract for [vibe-ctl](https://github.com/vibe-ctl/vibe-ctl).
This is the single package third-party plugin authors install from npm.

```bash
pnpm add @vibe-ctl/extension-api
```

## What's in here

- `Plugin` — abstract class plugins extend
- `PluginContext` — the `ctx` object injected by the runtime
- `PluginManifestSchema` — Zod schema for `plugin.json`
- `VibeEvents` / `VibeServices` — declaration-merging surfaces
- Widget, command, service, sync, mesh, UI, permission, and RPC types
- React hooks: `useWidgetConfig`, `useWidgetPlugin`, `useService`, `useUI`, `useAsync`

## Specs

The authoritative contract lives in `specs/`:

- [`specs/00-overview.md`](../../specs/00-overview.md) — vision and architecture
- [`specs/01-extension-system.md`](../../specs/01-extension-system.md) — plugin contract (this package)
- [`specs/02-kernel-runtime.md`](../../specs/02-kernel-runtime.md) — sync model the runtime implements

## Implementation note

This package is types-first. The `ctx.*` members are type declarations only —
real implementations are injected by `@vibe-ctl/runtime` at activation time.
Runtime stubs throw if invoked directly outside a plugin host.

## License

MIT
