/**
 * Interactive prompts for @vibe-ctl/create-plugin.
 *
 * Uses `prompts` for the terminal UI. When `skipPrompts` is set, fills
 * everything in from defaults so `--yes` mode still works.
 */

import prompts from 'prompts';

export type ExecutionContext = 'renderer' | 'main' | 'split';

export interface PromptAnswers {
  targetDir: string;
  pluginId: string;
  displayName: string;
  description: string;
  authorName: string;
  executionContext: ExecutionContext;
  includeExampleWidget: boolean;
}

export interface RunPromptsOpts {
  suggestedName: string | null;
  skipPrompts: boolean;
}

const DEFAULT_DESCRIPTION = 'A vibe-ctl plugin';
const DEFAULT_AUTHOR = '';

function normalizeId(raw: string): string {
  const trimmed = raw.trim();
  if (trimmed.startsWith('@')) return trimmed;
  return trimmed.toLowerCase().replace(/[^a-z0-9._/-]+/g, '-');
}

function validatePluginId(raw: string): true | string {
  const id = normalizeId(raw);
  const ok = /^(@[a-z0-9-]+\/)?[a-z0-9][a-z0-9._-]*$/.test(id);
  return ok || 'Must match /^(@scope\\/)?[a-z0-9][a-z0-9._-]*$/';
}

function onCancel(): never {
  console.log('\n✗ Cancelled.');
  process.exit(1);
}

export async function runPrompts(opts: RunPromptsOpts): Promise<PromptAnswers> {
  const suggestedDir = opts.suggestedName ?? 'my-plugin';
  const suggestedId = opts.suggestedName ? normalizeId(opts.suggestedName) : 'my-plugin';

  if (opts.skipPrompts) {
    return {
      targetDir: suggestedDir,
      pluginId: suggestedId,
      displayName: '',
      description: DEFAULT_DESCRIPTION,
      authorName: DEFAULT_AUTHOR,
      executionContext: 'renderer',
      includeExampleWidget: true,
    };
  }

  const answers = await prompts(
    [
      {
        type: 'text',
        name: 'targetDir',
        message: 'Target directory',
        initial: suggestedDir,
      },
      {
        type: 'text',
        name: 'pluginId',
        message: 'Plugin id (e.g. @your-scope/plugin-name)',
        initial: suggestedId,
        validate: validatePluginId,
      },
      {
        type: 'text',
        name: 'displayName',
        message: 'Display name (shown in UI)',
        initial: (_prev: unknown, values: Partial<PromptAnswers>) =>
          values.pluginId ? deriveName(values.pluginId) : 'My Plugin',
      },
      {
        type: 'text',
        name: 'description',
        message: 'Description',
        initial: DEFAULT_DESCRIPTION,
      },
      {
        type: 'text',
        name: 'authorName',
        message: 'Author name',
        initial: DEFAULT_AUTHOR,
      },
      {
        type: 'select',
        name: 'executionContext',
        message: 'Execution context',
        choices: [
          { title: 'renderer (UI-only, default)', value: 'renderer' },
          { title: 'main (Node APIs, no UI)', value: 'main' },
          { title: 'split (Node + UI; most common for services)', value: 'split' },
        ],
        initial: 0,
      },
      {
        type: 'confirm',
        name: 'includeExampleWidget',
        message: 'Include an example widget?',
        initial: true,
      },
    ],
    { onCancel },
  );

  return {
    targetDir: answers.targetDir,
    pluginId: normalizeId(answers.pluginId),
    displayName: answers.displayName,
    description: answers.description,
    authorName: answers.authorName,
    executionContext: answers.executionContext,
    includeExampleWidget: answers.includeExampleWidget,
  };
}

function deriveName(id: string): string {
  const tail = id.includes('/') ? id.split('/').pop()! : id;
  return tail
    .replace(/^vibe-ctl-plugin-/, '')
    .replace(/^plugin-/, '')
    .split(/[-_]/)
    .filter(Boolean)
    .map((w) => w[0]!.toUpperCase() + w.slice(1))
    .join(' ');
}
