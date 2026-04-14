# @vibe-ctl/create-plugin

Scaffold a new [vibe-ctl](https://github.com/vibe-ctl/vibe-ctl) plugin.

```bash
npx @vibe-ctl/create-plugin my-plugin
cd my-plugin
pnpm install
pnpm dev
```

## What it generates

- `plugin.json` -- manifest pre-filled from your answers
- `package.json` -- with `tsup` + `@vibe-ctl/tsconfig` wired up
- `tsup.config.ts` -- bundler config with host-provided externals
- `tsconfig.json` -- extends `@vibe-ctl/tsconfig/plugin.json`
- `src/` -- skeleton matching your chosen execution context
  (`renderer`, `main`, or `split`)
- optional example widget under `src/widgets/`

## Prompts

| Prompt | Options | Default |
|---|---|---|
| Plugin id | string (`@scope/name` or `name`) | derived from folder |
| Display name | string | derived from id |
| Execution context | `renderer`, `main`, `split` | `renderer` |
| Include example widget | yes/no | yes |

TypeScript is assumed for v1. A JavaScript option may be added later.

## Next steps after scaffolding

The CLI prints these; they are:

```bash
cd <plugin-dir>
pnpm install
pnpm dev
```

Then point vibe-ctl at the folder:

```bash
VIBE_CTL_DEV_PLUGINS=$(pwd) pnpm --filter @vibe-ctl/desktop dev
```
