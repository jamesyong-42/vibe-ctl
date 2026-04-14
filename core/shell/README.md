# @vibe-ctl/shell

Electron shell for vibe-ctl. Private package (not published to npm).

Owns the **platform layer** (spec 02 §2) and the host UI chrome:

- Electron main process: windows, tray, menus, protocol handlers,
  auto-updater, utility-process host for split plugins.
- Preload: `contextBridge` exposures to the renderer.
- Renderer: React root, App chrome, canvas + side-panel placements,
  version-gate, onboarding inventory banner.

Does NOT own domain logic. Domain features (agents, terminals,
notifications, etc.) are plugins loaded by `@vibe-ctl/runtime`.

See [`specs/02-kernel-runtime.md`](../../specs/02-kernel-runtime.md) §2
(Platform Layer) and §10 (Bootstrap Sequence) and
[`specs/03-monorepo-layout.md`](../../specs/03-monorepo-layout.md) §3 +
§7 for package boundaries.

## Boot flow

The shell constructs a `Runtime` from `@vibe-ctl/runtime` and walks the
bootstrap sequence of spec 02 §10:

1. `app.whenReady()`
2. Platform layer ready (windows/tray/menu handles prepared)
3. `runtime.start()` — sync fabric, version gate, discover, resolve,
   activate eager plugins
4. Create main window; renderer boots, mounts canvas placements
5. On `before-quit`: `runtime.stop()` in reverse-topo order

## Scripts

- `pnpm build` — `electron-vite build` (bundles main / preload / renderer
  to `out/`).
- `pnpm dev` — `electron-vite dev` with HMR.
- `pnpm typecheck` — `tsc --build` over main + renderer project
  references.
- `pnpm clean` — remove `out/`, `dist/`, `.turbo/`.

## Layout

```
src/
├── main/                        # Electron main process
│   ├── index.ts                 # Bootstrap + Runtime construction
│   ├── windows.ts               # WindowManager
│   ├── tray.ts                  # Tray icon + menu
│   ├── menu.ts                  # App menu (per-platform)
│   ├── protocol.ts              # host:// and plugin:// handlers
│   ├── auto-updater.ts          # electron-updater stub
│   └── utility-process-host.ts  # Spawns utilityProcess for split plugins
├── preload/
│   └── index.ts                 # contextBridge exposures
└── renderer/
    ├── index.html
    ├── main.tsx                 # React root
    ├── App.tsx                  # Shell chrome + placements
    ├── boot.ts                  # Renderer-side runtime init
    ├── version-gate/            # Blocking "update required" screen
    └── onboarding/              # "plugins available on peers" banner
```
