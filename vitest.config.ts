import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    passWithNoTests: true,
    include: [
      'core/*/src/**/*.test.ts',
      'plugins/*/src/**/*.test.ts',
      'tooling/*/src/**/*.test.ts',
    ],
    exclude: ['**/node_modules/**', '**/dist/**', '**/out/**'],
  },
});
