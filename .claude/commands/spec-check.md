---
description: Cross-check the current scaffold against the specs. Report drift.
allowed-tools: Read, Grep, Glob, Bash(ls *), Bash(find *)
---

Cross-reference the spec set (`docs/specs/00-overview.md` through
`docs/specs/04-registry-marketplace.md`) against what's actually in the repo.

Focus areas:

1. **Package catalogue** — spec 03 §6 lists first-party plugins. Does
   `plugins/` match? Any extra, any missing?
2. **Manifest compliance** — for each `plugins/*/plugin.json`, confirm it
   matches the schema in spec 01 §2. Common drift: missing `sync` field,
   wrong `executionContext`, missing `hostProvided`.
3. **Kernel decisions** — spec 02 §4 lists four kernel-managed docs and
   one version-beacons slice. Are they all referenced in
   `core/runtime/src/sync/kernel-docs.ts`?
4. **Plugin API surface** — spec 01 §5 lists every `ctx.*` member. Does
   `core/extension-api/src/context.ts` export them all? Does the runtime
   wire each one in `context-builder.ts`?

Report findings as a bulleted list grouped by area. Do NOT make changes;
just report. The user will decide which drifts to close.
