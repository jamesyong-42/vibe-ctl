# 04 -- Registry & Marketplace

> The distribution model for third-party plugins. How developers publish,
> how users discover and install, how updates flow.

**Depends on:** `01-extension-system.md`, `03-monorepo-layout.md`

---

## 1. Design Principles

1. **Git is the registry.** No backend server to run, no database, no auth.
   A single GitHub repo with a JSON index. This is Obsidian's model, and
   it works at scale.
2. **Plugins host themselves.** Each plugin lives in the author's own
   repo and publishes via GitHub Releases. We don't store plugin code;
   we only store pointers.
3. **Trust is layered.** First submission = manual review. Subsequent
   updates = author's word. Verified badges + signing for higher trust.
4. **Forkable.** Private/internal registries are just forks. Users can
   point vibe-ctl at any registry URL (defaults to the official one).
5. **No vendor lock-in.** Authors can leave the official registry at any
   time -- their plugin still works if users have a direct GitHub URL.

---

## 2. Registry Repository Layout

The official registry is a public GitHub repo:
**`github.com/vibe-ctl/plugins`** (separate from the main `vibe-ctl` repo).

```
vibe-ctl/plugins/
├── README.md                           # Explains what this repo is
├── PUBLISHING.md                       # How to publish a plugin
├── CONTRIBUTING.md                     # PR process
├── plugins.json                        # THE REGISTRY INDEX (single source of truth)
├── schema/
│   ├── plugins.v1.schema.json          # JSON Schema for plugins.json
│   ├── manifest.v1.schema.json         # JSON Schema for plugin.json (mirror of spec 01)
│   └── categories.json                 # Enumeration of plugin categories
├── verified/                           # Signing public keys for verified publishers
│   ├── acme-inc.pub
│   └── example-corp.pub
├── scripts/
│   ├── validate.ts                     # Runs in CI on PRs
│   ├── fetch-manifests.ts              # Fetches each plugin's manifest from GH release
│   └── publish.ts                      # Used by vibe-ctl-plugin-registry-tools CLI
└── .github/
    └── workflows/
        ├── validate-pr.yml             # CI on PRs
        └── nightly-audit.yml           # Checks for broken plugin URLs
```

### `plugins.json` structure

```jsonc
{
  "$schema": "./schema/plugins.v1.schema.json",
  "version": 1,                         // Registry format version
  "updated": "2026-05-01T12:00:00Z",    // Updated on each merge
  "plugins": [
    {
      // Identity
      "id": "com.acme.git-agent",       // Unique, globally
      "repo": "acme/vibe-git-agent",    // GitHub repo path (user/repo)
      "manifestPath": "plugin.json",    // Path in release asset (default: "plugin.json")

      // Display
      "name": "Git Agent",
      "description": "Claude agents specialized in git workflows",
      "category": "version-control",
      "keywords": ["git", "vcs", "agents"],
      "icon": "https://raw.githubusercontent.com/acme/vibe-git-agent/main/assets/icon.svg",
      "screenshots": [
        "https://raw.githubusercontent.com/acme/vibe-git-agent/main/screenshots/1.png"
      ],

      // Authorship
      "author": {
        "name": "Acme",
        "url": "https://acme.dev",
        "email": "plugins@acme.dev"
      },
      "license": "MIT",
      "homepage": "https://acme.dev/vibe-git-agent",

      // Trust
      "verified": false,                // true after team review + signing
      "signingKey": null,               // filename in verified/ if signed
      "addedAt": "2026-05-01",
      "reviewedBy": "@jamesyong",       // Reviewer's GitHub handle

      // Runtime
      "minimumApiVersion": "^1.0.0",    // Mirrors plugin.json apiVersion

      // Stats (populated by nightly job, not by PRs)
      "stars": null,                    // From GitHub API
      "downloads": null,                // Populated later when we track installs

      // Status
      "disabled": false,                // Team can disable without removing entry
      "disabledReason": null            // If disabled, why
    }
  ]
}
```

**What's NOT in the registry:**
- Plugin source code (lives in the author's GitHub)
- Built artifacts (fetched on-demand from GitHub Releases)
- User reviews, ratings (out of scope for v1)
- Install counts (maybe later, requires server)

---

## 3. Publishing Flow (for Plugin Authors)

### Step 1: Create the plugin

```bash
npx create-vibe-plugin my-awesome-plugin
cd my-awesome-plugin
# Edit src/, plugin.json, README.md
pnpm build
```

### Step 2: Publish to your own GitHub

```bash
git init
git remote add origin git@github.com:acme/vibe-git-agent.git
git push -u origin main

# Create a GitHub Release (via CLI or web):
gh release create v1.0.0 \
  dist/index.js \
  dist/plugin.json \
  dist/styles.css \
  --title "v1.0.0" \
  --notes "Initial release"
```

The release assets must include:
- `plugin.json` (the manifest)
- `index.js` (the bundled plugin code)
- `styles.css` (optional)
- Anything else referenced from the manifest (icons, etc.)

**Tag must equal the plugin version in `plugin.json`.** The registry
validates this.

### Step 3: Submit to the registry

Option A -- CLI (recommended):

```bash
npx vibe-ctl-plugin-registry-tools submit
# Interactive: prompts for repo, category, etc.
# Creates a fork, branch, commits plugins.json change, opens PR.
```

Option B -- manual PR:

Fork `vibe-ctl/plugins`, add your entry to `plugins.json` sorted
alphabetically by `id`, open a PR.

### Step 4: CI validation

GitHub Actions runs `scripts/validate.ts` on the PR:

```typescript
// scripts/validate.ts (sketch)
async function validate(prDiff: RegistryDiff) {
  const newEntries = prDiff.added;

  for (const entry of newEntries) {
    // 1. Schema validate
    await validateAgainstSchema(entry, 'plugins.v1.schema.json');

    // 2. Fetch latest release from entry.repo
    const release = await github.getLatestRelease(entry.repo);
    if (!release) throw new Error(`No release found at ${entry.repo}`);

    // 3. Download plugin.json from release
    const manifestAsset = release.assets.find(a => a.name === 'plugin.json');
    if (!manifestAsset) throw new Error('Release missing plugin.json');
    const manifest = await fetchJson(manifestAsset.browser_download_url);

    // 4. Validate manifest
    await validateAgainstSchema(manifest, 'manifest.v1.schema.json');

    // 5. Cross-checks
    if (manifest.id !== entry.id) throw new Error('ID mismatch');
    if (!semver.eq(manifest.version, release.tag_name.replace(/^v/, ''))) {
      throw new Error('Release tag must match manifest.version');
    }

    // 6. Duplicate ID check
    const existingIds = await loadExistingIds();
    if (existingIds.has(entry.id)) throw new Error('ID already exists');

    // 7. Reasonable size check (catches accidentally huge bundles)
    const indexAsset = release.assets.find(a => a.name === 'index.js');
    if (indexAsset.size > 10_000_000) { // 10 MB
      throw new Error('Bundle too large; please optimize');
    }

    // 8. Static analysis: scan for known-bad patterns
    const code = await fetchText(indexAsset.browser_download_url);
    await scanForMaliciousPatterns(code);
  }
}
```

Failing CI blocks the merge. Reviewer (a vibe-ctl maintainer) does a
human review on top of CI pass:
- Is the plugin functional? Quick smoke test.
- Is the description honest? Does it do what it claims?
- Any obvious security red flags in the code?
- Does the ID namespace look reasonable?

On merge: the plugin is live in the registry. vibe-ctl users see it on
their next registry refresh (auto-refreshes every 6 hours).

### Step 5: Publishing updates

**Once merged, you never PR again for updates.** Your plugin just:

1. Bumps `plugin.json` version
2. Creates a new GitHub Release with matching tag
3. Users' vibe-ctl auto-detects the new release and offers an update

No registry change needed.

The registry entry only changes when you want to update metadata
(description, screenshots, etc.) or transfer ownership.

---

## 4. Discovery Flow (in the App)

### Registry refresh

The app fetches `plugins.json` from the registry on a schedule:

```typescript
// @vibe-ctl/plugin-registry (a first-party plugin for the Extension Hub)
class RegistryClient {
  private CACHE_TTL = 6 * 60 * 60 * 1000;  // 6 hours
  private registryUrl: string;

  constructor(registryUrl = 'https://raw.githubusercontent.com/vibe-ctl/plugins/main/plugins.json') {
    this.registryUrl = registryUrl;
  }

  async fetch(force = false): Promise<RegistryIndex> {
    if (!force && this.isCacheFresh()) {
      return this.loadCached();
    }
    const res = await fetch(this.registryUrl, {
      headers: { 'User-Agent': 'vibe-ctl/1.0' },
    });
    if (!res.ok) throw new Error(`Registry fetch failed: ${res.status}`);
    const data = await res.json();
    await this.cache(data);
    return data;
  }
}
```

### Extension Hub UI (a built-in plugin)

A built-in plugin (`@vibe-ctl/plugin-extension-hub`) contributes a side
panel that shows the registry. It's just another plugin -- which is how
"everything is a plugin" dogfoods itself.

- Lists all plugins, filterable by category, keyword, verified status
- Shows stars from GitHub (fetched separately and cached)
- Click an entry → details view with screenshots, README rendered
- "Install" button → download + install flow (§5)
- "Update available" badge on installed plugins whose registry entry
  points to a newer release

### Alternative sources

Users can install plugins from sources the registry doesn't know about:

```
# From a GitHub URL directly
vibe-ctl://install?repo=acme/vibe-git-agent

# From a local folder (dev)
Settings → Plugins → Load from folder
```

The app UI exposes both: a "GitHub URL" input and a "Local folder" button.

---

## 5. Installation Flow

When user clicks "Install":

```
1. Resolve release
   → Read registry entry
   → GET https://api.github.com/repos/{repo}/releases/latest
   → Find assets: plugin.json, index.js, (styles.css, icons, etc.)

2. Download
   → Create temp dir ~/.vibe-ctl/install-staging/{plugin-id}/
   → Download all release assets in parallel
   → Verify plugin.json matches what the registry claimed (id, name)

3. Validate manifest
   → Zod validate against the current PluginManifestSchema
   → Check apiVersion is compatible with host's API version
   → Check engine.platform matches current OS

4. Permission review
   → If plugin declares permissions, show a confirmation dialog:
     "Install com.acme.git-agent?
      This plugin requests:
        • Read agent metadata
        • Spawn terminal sessions (prompts on first use)
      Source: github.com/acme/vibe-git-agent
      [Cancel]  [Install]"

5. Signature check (if signed)
   → If registry entry has signingKey, verify signature of plugin.json
     using the key in verified/{key}.pub
   → Refuse install on mismatch

6. Move to installed
   → Move staging dir to ~/.vibe-ctl/plugins/{plugin-id}/
   → Plugin is T3 (community). Tier is assigned by the kernel
     based on the install directory -- the plugin cannot claim T1.

7. Discover + load
   → Kernel rescans plugins/ dir
   → New entity created with PluginManifest component
   → If user enabled "auto-enable after install", kernel activates it
   → Otherwise plugin sits disabled until user enables in Settings
```

### Error handling

- Download fails → retry with backoff, show clear error on final failure
- Manifest invalid → abort, show validation error
- apiVersion incompatible → show "Requires vibe-ctl X.Y+ to install"
- Signature mismatch → abort, log security event
- Disk full / permission denied → abort with OS-specific guidance

---

## 6. Update Mechanism

### Update checking

Background job in `@vibe-ctl/plugin-extension-hub`:

```typescript
async function checkAllPluginsForUpdates() {
  const installed = await listInstalledPlugins();
  const registry = await registryClient.fetch();

  for (const plugin of installed) {
    const entry = registry.plugins.find(p => p.id === plugin.id);
    if (!entry) continue;  // Not in registry (installed via direct URL)

    const latestRelease = await github.getLatestRelease(entry.repo);
    if (!latestRelease) continue;
    const latestVersion = latestRelease.tag_name.replace(/^v/, '');

    if (semver.gt(latestVersion, plugin.version)) {
      emitEvent('plugin.update-available', {
        pluginId: plugin.id,
        currentVersion: plugin.version,
        newVersion: latestVersion,
        changelog: latestRelease.body,
      });
    }
  }
}
```

Runs on app start + every 24 hours.

### Update flow

When an update is available, the Extension Hub shows a badge. User
clicks "Update" → same flow as install, but:

1. **Permission diff** -- if the new version declares new permissions,
   show only the *new* ones and ask for re-consent.
2. **apiVersion check** -- if the new version requires a newer host,
   show "Update vibe-ctl first" and block the update.
3. **Atomic swap** -- download into staging, deactivate old plugin,
   move old → backup, move staging → installed, activate new. On failure,
   restore backup.
4. **Settings preservation** -- plugin's settings and `dataDir` are
   untouched during update. The plugin's `onSettingsMigrate` hook runs
   if schemaVersion changed.

### Rollback

If a plugin update breaks things, users can roll back:

```
Settings → Plugins → {plugin} → Version History → Install {prev-version}
```

We keep the previous version on disk for 30 days.

### Auto-update settings

Per-plugin and global:

| Scope | Setting | Default |
|---|---|---|
| Global | Check for updates | Enabled |
| Global | Auto-install patch updates | Disabled |
| Global | Auto-install minor updates | Disabled |
| Per-plugin | Auto-update | Disabled |
| Per-plugin | Update channel | `stable` (or `beta` if plugin publishes pre-releases) |

---

## 7. Trust Model

### Tier assignment recap

| Source | Tier | How trust works |
|---|---|---|
| Bundled in app (`resources/plugins/`) | T1 | Fully trusted. Can provide T1-only services. |
| Installed from registry with `verified: true` + signed | T2 | Elevated trust. Signed manifest verified against pinned pubkey. |
| Installed from registry (unverified) | T3 | Community trust. Permission prompts on first use. |
| Installed from direct GitHub URL | T3 | Same as registry unverified. |
| Loaded from dev folder | T3 | Same, but with dev features (hot reload, devStorage). |

### Getting verified

A plugin becomes verified (tier T2) through an out-of-band process:

1. Author submits PR changing `verified: false → true` on their entry
2. Author provides a GPG public key (added to `verified/` dir)
3. Maintainer reviews: established plugin, clear ownership, public-facing
   contact, no recent security incidents
4. On approval: plugin is re-published with a signed `plugin.json`
   (signature in a separate `plugin.json.sig` asset on the release)
5. Future updates from this plugin must include a valid signature

### Signature verification

```typescript
// Signed manifest:
// - plugin.json (the manifest)
// - plugin.json.sig (detached PGP signature over plugin.json)

async function verifySignature(
  manifest: Buffer,
  signature: Buffer,
  publicKeyPath: string,
): Promise<boolean> {
  const publicKey = await fs.readFile(publicKeyPath);
  return verifyDetached(publicKey, manifest, signature);  // via openpgp.js
}
```

If a verified plugin's update doesn't validate against the pinned key:
refuse the update. Log a security event. Notify the user.

### Revocation

If a verified plugin turns out to be malicious, the registry maintainer:

1. Adds plugin to `disabled: true` in `plugins.json` with reason
2. Revokes the signing key (moves `verified/key.pub` to `revoked/key.pub`)
3. Users' vibe-ctl on next registry fetch:
   - Sees plugin disabled → marks it as revoked in their UI
   - Offers to uninstall (non-forced; user chooses)
4. Out-of-band advisory published on the vibe-ctl homepage / blog

### Forks / Private registries

Any user can point vibe-ctl at a different registry URL:

```
Settings → Plugins → Registries → Add…
  URL: https://raw.githubusercontent.com/my-org/private-plugins/main/plugins.json
  Label: My Org
```

Multiple registries can be enabled simultaneously. Plugins with
duplicate IDs across registries show source-labeled in the UI; user picks
which to install. Perfect for:
- Internal org plugins not suitable for public
- Beta / nightly channels
- Curated subsets

---

## 8. `plugin-registry-tools` CLI

Published separately as `vibe-ctl-plugin-registry-tools` (or similar).
Helps plugin authors manage their registry entries.

```bash
# Submit a new plugin
vibe-ctl-plugin-registry submit
# Prompts interactively, opens PR

# Validate your plugin.json against the schema
vibe-ctl-plugin-registry validate ./plugin.json

# Check if your latest release is properly set up
vibe-ctl-plugin-registry check <repo>
# Verifies: tag matches version, plugin.json + index.js in assets, manifest valid

# Pre-release (not submitted to registry, users install via BRAT-style URL)
vibe-ctl-plugin-registry prerelease
```

---

## 9. Private Alternative: Tarball Install

For fully offline / airgapped / internal use, vibe-ctl also supports
installing from a local tarball:

```bash
vibe-ctl plugin install ./my-plugin-1.0.0.tar.gz
```

The tarball must contain:
- `plugin.json` at the root
- All referenced files (index.js, assets, etc.)

This bypasses the registry entirely. Useful for:
- Enterprise deployments
- Dev iteration without publishing
- Distribution via internal channels (Slack, email)

---

## 10. Economics (Future)

For v1 we build none of this. Listed for design completeness:

- **Free tier**: current design. All plugins free and open. Registry is
  a public GitHub repo.
- **Paid plugins (potential future)**: Plugin can declare `"priceModel":
  { "type": "one-time", "cents": 2000 }`. Checkout via Stripe / similar.
  Successful purchase grants a license token stored in `plugin-permissions.json`.
  Plugin code checks token at activation. This is all opt-in per plugin.
- **Donations**: Plugin manifest can include `"fundingUrl"` (like
  GitHub Sponsors, Patreon, Ko-fi, etc.). Shown in Extension Hub detail
  view.

---

## 11. Analytics & Telemetry

**None in v1.** No install counts tracked server-side. No telemetry phoned
home from the app. This is a principled choice that keeps the architecture
simple and the trust model clean.

If we want install stats later:
- Registry CI can run a nightly job that pings each plugin's GitHub
  Releases and reads download counts from there (GitHub's own stats).
- Or add an optional anonymous ping in vibe-ctl (opt-in, clearly disclosed).

---

## 12. Migration Path from Nothing

When vibe-ctl launches with empty registry:

1. Ship with just first-party plugins (all T1, no registry needed)
2. Open source the plugin SDK so early adopters can build plugins
3. Curate first ~10 plugins manually: invite a few devs, work with them
   to publish, seed the registry
4. Launch Extension Hub UI with those seed plugins visible
5. Open PRs to the public and let community grow organically

Obsidian did this exact arc. Took ~6 months to reach meaningful diversity.

---

## Decisions

- **Registry backend: GitHub repo** (`vibe-ctl/plugins`). Zero ops, free
  CDN via raw.githubusercontent.com, git history = audit trail,
  fork-friendly (alternate registries = forks). Users can point at any
  registry URL in settings.
- **`plugins.json` stays a single file.** ~500 bytes per plugin entry →
  10,000+ plugins fit comfortably. Split only if we actually hit scale
  problems.
- **No featured / editor's pick in v1.** Adds editorial overhead. Community
  self-curates via GitHub stars and a "popular" sort. Featured is a
  post-launch polish item.
- **Signing: GPG.** Most plugin authors already have GPG for git commits.
  Sigstore is more modern but its OIDC flow is unfamiliar. Migration path
  open if the ecosystem shifts.
- **Plugin ID convention: npm scope form `@scope/name`.** Matches where
  plugins will be distributed (often on npm even if not required).
  Familiar in the JS ecosystem. Not reverse-domain (`com.acme.foo`).
- **Plugin deprecation: `"deprecated": true` + optional `"replacement":
  "@other/plugin"` in the registry entry.** Warning shown in plugin
  manager UI; install still allowed for backwards compat; replacement
  suggested. Author updates via PR.
- **Workspace bundles ("install these 5 at once") deferred.** Post-launch
  UX polish. Not blocking v1.
- **`create-vibe-plugin` CLI is the primary scaffold.** A public
  `vibe-ctl/plugin-template` repo exists as a forkable reference for
  authors who prefer that starting point, but docs point to the CLI
  first.
