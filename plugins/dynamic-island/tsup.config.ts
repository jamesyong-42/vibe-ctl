import { definePluginConfig } from '@vibe-ctl/tsup-plugin-preset';

export default definePluginConfig({
  entry: { main: 'src/main.ts', renderer: 'src/renderer.ts' },
});
