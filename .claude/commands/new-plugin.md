---
argument-hint: <plugin-short-name>
description: Scaffold a new first-party plugin matching the monorepo conventions.
allowed-tools: Read, Write, Edit, Bash(ls *), Bash(mkdir *)
---

Scaffold a new first-party plugin at `plugins/$1/`.

Read `docs/specs/01-extension-system.md` §2, §13 and
`docs/specs/03-monorepo-layout.md` §5, §6 first to confirm current conventions.

Before scaffolding:
1. Check `plugins/` for an existing plugin named `$1` — if it exists, stop
   and ask the user whether to overwrite.
2. Ask (if not clear from the name) whether the plugin should be
   `renderer`, `main`, or `split` execution context.
3. Ask what service ID (if any) this plugin provides.

Then create:

```
plugins/$1/
├── package.json                     # @vibe-ctl/plugin-$1
├── plugin.json                      # Manifest (exec context + permissions)
├── tsup.config.ts                   # ESM, externalize host-provided
├── tsconfig.json                    # extends @vibe-ctl/tsconfig/plugin.json
├── README.md
├── assets/icon.svg                  # 24×24 monochrome placeholder
└── src/
    ├── index.ts  (OR main.ts + renderer.ts for split)
    └── widgets/PlaceholderWidget.tsx
```

Mirror the conventions from existing first-party plugins (e.g.,
`plugins/themes/` for renderer, `plugins/claude-code/` for split). Keep the
body stubbed (`this.ctx.widgets.register(...)` with a placeholder widget).

After scaffolding, tell the user to run:

```bash
pnpm install
pnpm --filter @vibe-ctl/plugin-$1 build
```
