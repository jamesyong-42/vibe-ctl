import { z } from 'zod';

export const settingsSchemas = {
  'settings.read': {
    request: z.object({ scope: z.string() }),
    response: z.unknown(),
  },
  'settings.write': {
    request: z.object({ scope: z.string(), value: z.unknown() }),
    response: z.void(),
  },
} as const;
