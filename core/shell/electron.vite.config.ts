import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig, externalizeDepsPlugin } from 'electron-vite';

const __dirname = fileURLToPath(new URL('.', import.meta.url));

/**
 * Filename MUST be `electron.vite.config.*` — electron-vite only discovers
 * that exact name. A hyphenated name is silently ignored and the tool
 * falls back to a plugin-less zero-config build (no Tailwind, no React plugin,
 * no HMR wiring). Keep the dots.
 *
 * Format strategy:
 *   main     → ESM  (package.json has `"type": "module"`; lets main
 *                   `import` ESM-only workspace deps like @vibe-ctl/runtime)
 *   preload  → CJS  (Electron's sandboxed preload loader can only execute
 *                   CommonJS — ESM .mjs preloads fail with "Cannot use
 *                   import statement outside a module")
 *   renderer → ESM  (Vite default)
 *
 * The preload is NOT built through electron-vite: when `"type": "module"`
 * is set, electron-vite v5 forces preload to ESM `.mjs` and silently
 * ignores `rollupOptions.output.format: 'cjs'`. Instead, a sibling
 * `scripts/build-preload.mjs` invokes esbuild directly to emit CJS
 * `out/preload/index.js`. See package.json `build` / `dev` scripts.
 * The `preload` block below is omitted so electron-vite doesn't build
 * (and stomp on) our preload artifact.
 */
export default defineConfig({
  main: {
    plugins: [externalizeDepsPlugin()],
    build: {
      rollupOptions: {
        input: { index: resolve(__dirname, 'src/main/index.ts') },
      },
    },
  },
  // preload is built separately via scripts/build-preload.mjs
  renderer: {
    plugins: [tailwindcss(), react()],
    root: resolve(__dirname, 'src/renderer'),
    build: {
      rollupOptions: {
        input: { index: resolve(__dirname, 'src/renderer/index.html') },
      },
    },
  },
});
