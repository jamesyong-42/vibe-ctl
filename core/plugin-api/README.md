# @vibe-ctl/plugin-api

The public plugin contract for [vibe-ctl](https://github.com/vibe-ctl/vibe-ctl).
This is the single package third-party plugin authors install from npm.

```bash
pnpm add @vibe-ctl/plugin-api
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

- [`../../docs/specs/00-overview.md`](../../../../docs/specs/00-overview.md) — vision and architecture
- [`../../docs/specs/01-plugin-system.md`](../../../../docs/specs/01-plugin-system.md) — plugin contract (this package)
- [`../../docs/specs/02-kernel-runtime.md`](../../../../docs/specs/02-kernel-runtime.md) — sync model the runtime implements

## Implementation note

This package is types-first. The `ctx.*` members are type declarations only —
real implementations are injected by `@vibe-ctl/runtime` at activation time.
Runtime stubs throw if invoked directly outside a plugin host.

## License

MIT
