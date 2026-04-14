# @vibe-ctl/runtime

The kernel runtime for vibe-ctl. Private package (not published to npm).

Owns:

- The single truffle `NapiNode` (Layer 2 — Sync Fabric).
- The four kernel-managed shared docs: `kernel/plugin-inventory`,
  `kernel/canvas-layout`, `kernel/user-settings`, `kernel/permissions`.
- The plugin host: discovery, dependency resolution, activation,
  deactivation, disposables.
- The service registry (provide / require / optional with proxy
  invalidation).
- The kernel ECS world (reactive-ecs) that mirrors sync state into
  components so UI queries re-fire on sync deltas.
- Command registry, settings, permissions, health monitoring.

See [`../../docs/specs/02-kernel-runtime.md`](../../../../docs/specs/02-kernel-runtime.md) for
the authoritative design and [`../../docs/specs/03-monorepo-layout.md`](../../../../docs/specs/03-monorepo-layout.md)
for package boundaries.

## Public surface

```ts
import { Runtime, type RuntimeOptions } from '@vibe-ctl/runtime';
```

The runtime is consumed by `@vibe-ctl/shell` and, in tests, directly. It
is never imported by plugins — plugins talk to the runtime through
`ctx.*` façades defined in `@vibe-ctl/plugin-api`.

## Scripts

- `pnpm build` — bundle via tsup, emit `dist/`.
- `pnpm dev` — tsup watch mode.
- `pnpm typecheck` — `tsc --noEmit`.
- `pnpm clean` — remove build artifacts.
