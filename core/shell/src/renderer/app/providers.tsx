/**
 * Provider stack that wraps every screen.
 *
 * Cross-screen concerns only — screen-specific providers (engine,
 * dock) stay inside their respective screens so their scope is
 * bounded. Per spec 05 §9.1 the composition order is:
 *
 *   1. LogProvider            (Phase 2 — not yet)
 *   2. HostBridgeProvider     (awaits preload handshake)
 *   3. EventStreamProvider    (subscribes to eventPort)
 *   4. ThemeProvider
 *   5. I18nProvider           (deferred — single locale v1)
 *   6. ScreenStateProvider    (lives inside <ScreenRouter>)
 *
 * `HostBridgeProvider` renders a `fallback` while the handshake is in
 * flight; the screen router's BootScreen takes over on ready.
 */

import type { FC, ReactNode } from 'react';
import { EventStreamProvider, HostBridgeProvider } from '../host/index.js';
import { ThemeProvider } from './theme/ThemeProvider.js';

/**
 * `HostBridgeProvider` renders the `fallback` while the preload
 * handshake is in flight — commit 9 wires `<BootScreen>` in here.
 */
export const AppProviders: FC<{ children: ReactNode }> = ({ children }) => (
  <HostBridgeProvider>
    <EventStreamProvider>
      <ThemeProvider>{children}</ThemeProvider>
    </EventStreamProvider>
  </HostBridgeProvider>
);
