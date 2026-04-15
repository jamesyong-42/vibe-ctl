/**
 * Provider stack that wraps every screen. Cross-screen concerns only —
 * screen-specific providers (e.g. engine, dock) stay inside their
 * respective screens so their scope is bounded.
 */

import type { FC, ReactNode } from 'react';
import { ThemeProvider } from './theme/ThemeProvider.js';

export const AppProviders: FC<{ children: ReactNode }> = ({ children }) => (
  <ThemeProvider>{children}</ThemeProvider>
);
