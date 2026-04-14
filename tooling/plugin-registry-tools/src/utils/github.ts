/**
 * Tiny GitHub API wrapper. Stubbed; real implementation will use either
 * `gh` (shelled out) or fetch against api.github.com with a token from
 * the env.
 *
 * Per spec: do NOT actually call GitHub from these stubs.
 */

export interface Release {
  id: number;
  tag_name: string;
  name: string | null;
  body: string | null;
  draft: boolean;
  prerelease: boolean;
  assets: ReleaseAsset[];
}

export interface ReleaseAsset {
  id: number;
  name: string;
  size: number;
  browser_download_url: string;
}

export interface PullRequestResult {
  number: number;
  html_url: string;
}

export interface OpenPrOpts {
  owner: string;
  repo: string;
  head: string; // "my-user:branch-name"
  base: string; // usually "main"
  title: string;
  body: string;
}

/**
 * Fetch the latest, non-draft release from the given repo.
 * TODO: implement via `GET /repos/{owner}/{repo}/releases/latest`.
 */
export async function getLatestRelease(_repo: string): Promise<Release | null> {
  throw new Error('getLatestRelease: not implemented');
}

/**
 * Download a release asset as JSON. Used to grab plugin.json from the
 * release the user is trying to publish.
 * TODO: fetch asset.browser_download_url, parse as JSON.
 */
export async function fetchJsonAsset(_release: Release, _assetName: string): Promise<unknown> {
  throw new Error('fetchJsonAsset: not implemented');
}

/**
 * Fork `vibe-ctl/plugins` into the authenticated user's account.
 * TODO: implement via `POST /repos/vibe-ctl/plugins/forks` and poll
 * until the fork is ready.
 */
export async function forkRegistry(): Promise<{ owner: string; repo: string }> {
  throw new Error('forkRegistry: not implemented');
}

/**
 * Open a PR from the fork back to vibe-ctl/plugins.
 * TODO: implement via `POST /repos/{owner}/{repo}/pulls`.
 */
export async function openPullRequest(_opts: OpenPrOpts): Promise<PullRequestResult> {
  throw new Error('openPullRequest: not implemented');
}

/**
 * Best-effort check that the user has working GitHub credentials.
 * TODO: try `gh auth status`, fall back to `GITHUB_TOKEN`.
 */
export async function assertAuthenticated(): Promise<void> {
  throw new Error('assertAuthenticated: not implemented');
}
