import semver from 'semver';
import { z } from 'zod';

/**
 * Default set of host-provided modules. Plugins mark these `external`
 * in their bundler so the runtime can inject singletons. Authors may
 * extend this list in `manifest.hostProvided` for their own shared deps.
 */
export const DEFAULT_HOST_PROVIDED: readonly string[] = [
  '@vibe-ctl/plugin-api',
  'react',
  'react-dom',
  '@jamesyong42/infinite-canvas',
  '@jamesyong42/reactive-ecs',
  '@vibecook/truffle',
];

const semverValid = (v: string): boolean => semver.valid(v) !== null;
const semverRangeValid = (r: string): boolean => semver.validRange(r) !== null;

const AuthorSchema = z.union([
  z.string(),
  z.object({
    name: z.string(),
    url: z.string().url().optional(),
  }),
]);

const EntrySchema = z.union([
  z.string(),
  z.object({
    main: z.string(),
    renderer: z.string(),
  }),
]);

const EnginesSchema = z.object({
  'vibe-ctl': z.string().refine(semverRangeValid, { message: 'Invalid semver range' }),
  platform: z.array(z.enum(['darwin', 'linux', 'win32'])).optional(),
});

const SyncDataEntrySchema = z.object({
  name: z.string().min(1),
  type: z.enum(['crdt', 'store']),
  scope: z.enum(['user-global', 'per-device']),
});

const SyncSchema = z
  .object({
    settings: z.boolean().default(true),
    data: z.array(SyncDataEntrySchema).default([]),
  })
  .default({ settings: true, data: [] });

/**
 * Zod schema for `plugin.json`. See spec 01 §2 for field semantics.
 */
export const PluginManifestSchema = z.object({
  // Identity
  id: z.string().regex(/^(@[a-z0-9-]+\/)?[a-z0-9][a-z0-9._-]*$/),
  name: z.string().min(1).max(80),
  version: z.string().refine(semverValid, { message: 'Invalid semver' }),
  apiVersion: z.string().refine(semverRangeValid, { message: 'Invalid semver range' }),

  // Metadata
  description: z.string().max(500).optional(),
  author: AuthorSchema.optional(),
  license: z.string().optional(),
  homepage: z.string().url().optional(),
  repository: z.string().optional(),
  icon: z.string().optional(),

  // Execution
  executionContext: z.enum(['renderer', 'main', 'split']).default('renderer'),
  entry: EntrySchema,
  eagerActivation: z.boolean().default(false),

  // Compatibility
  engines: EnginesSchema,

  // Services
  provides: z
    .record(z.string(), z.string().refine(semverValid, { message: 'Invalid semver' }))
    .default({}),
  dependencies: z
    .record(z.string(), z.string().refine(semverRangeValid, { message: 'Invalid semver range' }))
    .default({}),
  optionalDependencies: z
    .record(z.string(), z.string().refine(semverRangeValid, { message: 'Invalid semver range' }))
    .default({}),
  waitForReady: z.array(z.string()).default([]),

  // Sync
  sync: SyncSchema,

  // Permissions
  permissions: z.array(z.string()).default([]),

  // Host-provided externals
  hostProvided: z.array(z.string()).default([...DEFAULT_HOST_PROVIDED]),
});

/**
 * Runtime type inferred from the manifest schema.
 */
export type PluginManifest = z.infer<typeof PluginManifestSchema>;

/**
 * Convenience parser. Throws a zod `ZodError` on invalid input.
 */
export function parseManifest(input: unknown): PluginManifest {
  return PluginManifestSchema.parse(input);
}
