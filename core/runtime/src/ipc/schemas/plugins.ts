import { z } from 'zod';

const pluginInfo = z.object({
  id: z.string(),
  name: z.string(),
  version: z.string(),
  tier: z.enum(['T1', 'T2', 'T3']),
  enabled: z.boolean(),
});

const installSource = z.union([
  z.object({ kind: z.literal('registry'), id: z.string() }),
  z.object({ kind: z.literal('github'), repo: z.string() }),
  z.object({ kind: z.literal('tarball'), path: z.string() }),
]);

export const pluginsSchemas = {
  'plugins.list': {
    request: z.void(),
    response: z.array(pluginInfo),
  },
  'plugins.enable': {
    request: z.object({ id: z.string() }),
    response: z.void(),
  },
  'plugins.disable': {
    request: z.object({ id: z.string() }),
    response: z.void(),
  },
  'plugins.install': {
    request: z.object({ source: installSource }),
    response: z.object({ id: z.string() }),
  },
} as const;
