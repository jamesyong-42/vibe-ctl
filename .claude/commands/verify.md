---
description: Run full verification — install, build, typecheck, lint. Stops at first failure.
allowed-tools: Bash(pnpm *), Read
---

Run the full verification chain:

```bash
pnpm install
pnpm build
pnpm typecheck
pnpm lint
```

If any step fails, stop and summarize the failures. Read relevant source
files to diagnose. Do NOT attempt fixes unless the user asks; report the
failing files, error types, and a one-line cause per issue.
