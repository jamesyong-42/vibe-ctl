const fs = require('node:fs');
const path = require('node:path');

// Local module paths. If they exist on disk, pnpm auto-links to them for
// instant iteration; otherwise falls back to the npm registry version.
const LOCAL_MODULES = {
  '@vibecook/truffle': '../p008/truffle/crates/truffle-napi',
  '@vibecook/spaghetti-sdk': '../p008/spaghetti/packages/sdk',
  '@vibecook/avocado-sdk': '../p008/avocado/packages/sdk',
  '@jamesyong42/infinite-canvas': '../infinite-canvas/packages/infinite-canvas',
  '@jamesyong42/reactive-ecs': '../reactive-ecs',
};

function readPackage(pkg) {
  // Only rewrite dependencies + devDependencies. pnpm rejects `link:` in
  // peerDependencies; peers stay as semver ranges and resolve through the
  // workspace's actual (possibly link:-resolved) versions.
  //
  // We pass an ABSOLUTE path to `link:` because pnpm resolves relative
  // `link:` paths from the importing package's location, not from the
  // workspace root where this .pnpmfile.cjs sits.
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
