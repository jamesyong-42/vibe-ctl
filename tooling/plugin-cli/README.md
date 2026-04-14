# @vibe-ctl/plugin-cli

Publishing and validation CLI for the [vibe-ctl plugin registry](https://github.com/vibe-ctl/plugins).

## Install

```bash
pnpm add -g @vibe-ctl/plugin-cli
# or run ad-hoc:
npx @vibe-ctl/plugin-cli <command>
```

## Commands

| Command | What it does |
|---|---|
| `submit` | Fork `vibe-ctl/plugins`, add your entry, open a PR. |
| `validate <plugin.json>` | Validate a manifest against the Zod schema exported by `@vibe-ctl/plugin-api`. |
| `check <owner/repo>` | Verify your latest GitHub Release has the required assets, the tag matches `version`, and the manifest is valid. |
| `prerelease` | Generate a BRAT-style install URL for a pre-release build (not submitted to the registry). |

Every command accepts `--help`.

See `../../docs/specs/04-registry-marketplace.md` for the full publishing flow this CLI automates.

## Status

Most commands are stubs with clear TODOs. They print a "not implemented yet" notice and exit cleanly so you can wire up the real logic without breaking the CLI surface.
