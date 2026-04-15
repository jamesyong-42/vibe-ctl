import { z } from 'zod';

export const systemSchemas = {
  'system.ping': {
    request: z.void(),
    response: z.object({ pong: z.literal(true), ts: z.number() }),
  },
  'system.platform': {
    request: z.void(),
    response: z.enum(['darwin', 'linux', 'win32']),
  },
  'system.openExternal': {
    request: z.object({ url: z.string().url() }),
    response: z.void(),
  },
} as const;
