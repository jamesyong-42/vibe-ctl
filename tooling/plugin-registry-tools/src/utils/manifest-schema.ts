/**
 * Re-export / wrap the manifest Zod schema from @vibe-ctl/extension-api.
 *
 * Kept as a thin layer so the CLI can add shape for registry entries
 * (which are a superset of the plugin manifest) without having to touch
 * the extension-api package.
 */

import { PluginManifestSchema } from '@vibe-ctl/extension-api';
import { z } from 'zod';

export type PluginManifest = z.infer<typeof PluginManifestSchema>;

/**
 * Registry entry shape (spec 04 §2). Not every field is strictly
 * required in the registry JSON — optional fields stay optional here.
 */
export const RegistryEntrySchema = z.object({
  id: z.string(),
  repo: z.string().regex(/^[^/]+\/[^/]+$/, 'Expected owner/repo'),
  manifestPath: z.string().default('plugin.json'),

  name: z.string().optional(),
  description: z.string().max(500),
  category: z.string(),
  keywords: z.array(z.string()).optional(),
  icon: z.string().url().optional(),
  screenshots: z.array(z.string().url()).optional(),

  author: z.object({
    name: z.string(),
    url: z.string().url().optional(),
    email: z.string().email().optional(),
  }),
  license: z.string().optional(),
  homepage: z.string().url().optional(),

  verified: z.boolean().default(false),
  signingKey: z.string().nullable().default(null),
  addedAt: z.string(),
  reviewedBy: z.string().nullable().default(null),

  minimumApiVersion: z.string(),

  stars: z.number().nullable().optional(),
  downloads: z.number().nullable().optional(),

  disabled: z.boolean().default(false),
  disabledReason: z.string().nullable().default(null),
});

export type RegistryEntry = z.infer<typeof RegistryEntrySchema>;

export interface ValidationIssue {
  path: string;
  message: string;
}

export type ValidationResult<T> = { ok: true; value: T } | { ok: false; issues: ValidationIssue[] };

function zodIssuesToIssues(error: z.ZodError): ValidationIssue[] {
  return error.issues.map((i) => ({
    path: i.path.length ? i.path.join('.') : '(root)',
    message: i.message,
  }));
}

export function validateManifest(input: unknown): ValidationResult<PluginManifest> {
  const parsed = PluginManifestSchema.safeParse(input);
  if (parsed.success) return { ok: true, value: parsed.data };
  return { ok: false, issues: zodIssuesToIssues(parsed.error) };
}

export function validateRegistryEntry(input: unknown): ValidationResult<RegistryEntry> {
  const parsed = RegistryEntrySchema.safeParse(input);
  if (parsed.success) return { ok: true, value: parsed.data };
  return { ok: false, issues: zodIssuesToIssues(parsed.error) };
}
