# Security Policy

## Reporting a Vulnerability

**Do not report security issues in public GitHub issues.**

Please report suspected vulnerabilities privately via one of:

- Email: [me@jamesyong42.com](mailto:me@jamesyong42.com) (PGP available on request)
- GitHub: [private vulnerability reporting](https://github.com/jamesyong-42/vibe-ctl/security/advisories/new)

Include, if possible:

- Affected package(s) and version(s)
- Reproduction steps or a proof-of-concept
- Impact assessment (what an attacker can achieve)
- Any suggested mitigation

You should receive an acknowledgement within 72 hours. If you do not,
please follow up — mail may have been filtered.

## Scope

This policy covers code in this repository, including:

- `@vibe-ctl/plugin-api`
- `@vibe-ctl/plugin-cli`
- `@vibe-ctl/create-plugin`
- `@vibe-ctl/tsconfig`
- The vibe-ctl desktop app (`apps/desktop`) and kernel (`core/*`)
- First-party plugins shipped under `plugins/*`

Third-party community plugins are **not** covered — report those to their
respective authors.

## Out of scope

- Vulnerabilities in dependencies — report upstream.
- Issues requiring physical access to an unlocked device.
- Denial of service against a single local process.

## Disclosure

We follow a coordinated disclosure model. Once a fix is ready and
released, a GitHub Security Advisory will be published crediting the
reporter (unless anonymity is requested).
