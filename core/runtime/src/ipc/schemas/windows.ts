import { z } from 'zod';

export const windowsSchemas = {
  'windows.detachWidget': {
    request: z.object({ widgetId: z.string() }),
    response: z.object({ windowId: z.number() }),
  },
  'windows.closeDetached': {
    request: z.object({ windowId: z.number() }),
    response: z.void(),
  },
} as const;
