/**
 * check — verify a repo's latest GitHub Release is registry-ready.
 *
 * Checks (spec 04 §3):
 *   1. Release tag matches plugin.json.version (strip leading `v`).
 *   2. Release contains plugin.json asset.
 *   3. Release contains the entry asset(s) declared in plugin.json.entry.
 *   4. plugin.json passes schema validation.
 *   5. Bundle size sanity check.
 *
 * Currently a stub — network calls deferred. Function signatures make
 * it clear what the real implementation needs to do.
 */

import kleur from 'kleur';

import { fetchJsonAsset, getLatestRelease } from '../utils/github.js';
import { validateManifest } from '../utils/manifest-schema.js';

export async function checkCommand(argv: string[]): Promise<void> {
  if (argv.length === 0 || argv.includes('--help') || argv.includes('-h')) {
    console.log(`
${kleur.bold('check')} — verify a repo's latest release is registry-ready.

${kleur.bold('Usage')}
  vibe-ctl-plugin-registry check <owner/repo>
`);
    if (argv.length === 0) process.exit(1);
    return;
  }

  const repo = argv[0]!;
  if (!/^[^/]+\/[^/]+$/.test(repo)) {
    console.error(kleur.red(`✗ Expected owner/repo, got "${repo}"`));
    process.exit(1);
  }

  console.log(kleur.cyan(`▸ Checking ${repo}\n`));

  // TODO: real implementation
  //   const release = await getLatestRelease(repo);
  //   if (!release) fail('No releases found');
  //   const manifest = await fetchJsonAsset(release, 'plugin.json');
  //   const parsed = validateManifest(manifest);
  //   if (!parsed.ok) fail('Manifest invalid', parsed.issues);
  //   assert release.tag_name matches `v?${parsed.value.version}`
  //   for each asset referenced in manifest.entry → confirm present
  //   check index bundle size <10MB

  // Silence unused-import warnings while stubbed:
  void getLatestRelease;
  void fetchJsonAsset;
  void validateManifest;

  console.log(
    kleur.yellow('⚠ check is not implemented yet. See the TODO list in src/commands/check.ts.'),
  );
}
