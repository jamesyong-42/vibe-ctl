import { z } from 'zod';

export const permissionsSchemas = {
  'permissions.respond': {
    request: z.object({ promptId: z.string(), granted: z.boolean() }),
    response: z.void(),
  },
  'permissions.revoke': {
    request: z.object({ pluginId: z.string(), permission: z.string() }),
    response: z.void(),
  },
} as const;
