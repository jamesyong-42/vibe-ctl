import type { ScaffoldContext } from '../scaffold.js';

export function readmeMdTemplate(ctx: ScaffoldContext): string {
  return `# ${ctx.displayName}

${ctx.description}

## Develop

\`\`\`bash
pnpm install
pnpm dev
\`\`\`

Then point vibe-ctl at this folder:

\`\`\`bash
VIBE_CTL_DEV_PLUGINS=$(pwd) pnpm --filter @vibe-ctl/desktop dev
\`\`\`

## Publish

1. Bump \`version\` in \`plugin.json\` and \`package.json\`.
2. \`pnpm build\`.
3. Create a GitHub Release whose tag equals \`version\`, attach:
   - \`dist/plugin.json\`
   - \`dist/${ctx.executionContext === 'split' ? 'main.js' : 'index.js'}\`
   - (split only) \`dist/renderer.js\`
   - any referenced assets
4. Submit to the registry:

   \`\`\`bash
   npx vibe-ctl-plugin-registry-tools submit
   \`\`\`

See \`vibe-ctl/../../../../docs/specs/04-registry-marketplace.md\` for the full flow.
`;
}
