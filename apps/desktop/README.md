# @vibe-ctl/desktop

Electron app shell for vibe-ctl. The thinnest possible packaging
wrapper around `@vibe-ctl/shell`.

Responsibilities:

- Packaging via `electron-builder` (DMG / NSIS / AppImage / deb).
- Bundling built-in T1 plugins into `resources/plugins/` (populated by
  turbo's `bundle-plugins` task — see spec 03 §7).
- Bundling OS assets (icons, macOS NotchHelper binary, etc.) into
  `resources/`.

All runtime behaviour lives in `@vibe-ctl/shell`. `package.json > main`
points at the shell's compiled main-process entry
(`../../core/shell/out/main/index.js`), so `electron .` and
`electron-builder` both find the kernel bootstrap.

## Scripts

- `pnpm build` — no-op. The desktop app is "built" transitively by
  `@vibe-ctl/shell`'s `electron-vite build`.
- `pnpm dev` — delegates to `@vibe-ctl/shell`'s dev server.
- `pnpm package` — runs `electron-builder` with `electron-builder.yml`.
- `pnpm typecheck` — `tsc --noEmit` over `src/`.

## Layout

```
apps/desktop/
├── electron-builder.yml       # Packaging config
├── resources/
│   ├── icons/                 # App + tray + doc icons
│   └── plugins/               # Populated by `turbo run bundle-plugins`
├── src/
│   └── index.ts               # Type re-exports for tooling
└── release/                   # electron-builder output (gitignored)
```

See [`specs/03-monorepo-layout.md`](../../specs/03-monorepo-layout.md) §7
for the desktop-app boundary and the plugin-bundling task.
