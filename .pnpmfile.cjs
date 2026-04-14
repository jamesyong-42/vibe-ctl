const fs = require('node:fs');
const path = require('node:path');

// Opt-in local-module linking for fast iteration on sibling repos.
//
// Why opt-in: link: rewrites land in pnpm-lock.yaml as absolute paths and
// break CI's --frozen-lockfile (the lockfile then doesn't match any
// machine without those exact paths). Gating on VIBE_LINK_LOCAL keeps
// the committed lockfile portable; devs who want live-linked iteration
// run `VIBE_LINK_LOCAL=1 pnpm install` and are responsible for not
// committing the resulting lockfile.
const LOCAL_MODULES = {
  '@vibecook/truffle': '../p008/truffle/crates/truffle-napi',
  '@vibecook/spaghetti-sdk': '../p008/spaghetti/packages/sdk',
  '@vibecook/avocado-sdk': '../p008/avocado/packages/sdk',
  '@jamesyong42/infinite-canvas': '../infinite-canvas/packages/infinite-canvas',
  '@jamesyong42/reactive-ecs': '../reactive-ecs',
};

function readPackage(pkg) {
  if (!process.env.VIBE_LINK_LOCAL) return pkg;

  // Only rewrite dependencies + devDependencies. pnpm rejects `link:` in
  // peerDependencies; peers stay as semver ranges and resolve through the
  // workspace's actual (possibly link:-resolved) versions.
  //
  // Absolute path because pnpm resolves relative `link:` paths from the
  // importing package's location, not from the workspace root.
  for (const [name, localPath] of Object.entries(LOCAL_MODULES)) {
    const absPath = path.resolve(__dirname, localPath);
    if (!fs.existsSync(absPath)) continue;

    if (pkg.dependencies?.[name]) {
      pkg.dependencies[name] = `link:${absPath}`;
    }
    if (pkg.devDependencies?.[name]) {
      pkg.devDependencies[name] = `link:${absPath}`;
    }
  }
  return pkg;
}

module.exports = { hooks: { readPackage } };
