import { z } from 'zod';

export const updaterSchemas = {
  'updater.check': {
    request: z.void(),
    response: z.object({
      available: z.boolean(),
      version: z.string().optional(),
    }),
  },
  'updater.install': {
    request: z.void(),
    response: z.void(),
  },
  'updater.defer': {
    request: z.object({ hours: z.number().int().positive() }),
    response: z.void(),
  },
} as const;
