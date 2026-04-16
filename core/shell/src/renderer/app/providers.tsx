/**
 * Provider stack that wraps every screen.
 *
 * Cross-screen concerns only — screen-specific providers (engine,
 * dock) stay inside their respective screens so their scope is
 * bounded. Per spec 05 §9.1 the composition order is:
 *
 *   1. LogProvider            (Phase 2 — not yet)
 *   2. HostBridgeProvider     (exposes bridge context; always renders children)
 *   3. EventStreamProvider    (subscribes to eventPort — skipped during boot)
 *   4. ThemeProvider
 *   5. I18nProvider           (deferred — single locale v1)
 *   6. ScreenStateProvider    (lives inside <ScreenRouter>)
 *
 * `HostBridgeProvider` never renders a fallback — the screen state
 * machine in `useScreenState` owns the `'boot'` state and the
 * `ScreenRouter` renders `<BootScreen />` while the handshake is
 * in flight.
 */

import type { FC, ReactNode } from 'react';
import { EventStreamProvider, HostBridgeProvider } from '../host/index.js';
import { ThemeProvider } from './theme/ThemeProvider.js';

export const AppProviders: FC<{ children: ReactNode }> = ({ children }) => (
  <HostBridgeProvider>
    <EventStreamProvider>
      <ThemeProvider>{children}</ThemeProvider>
    </EventStreamProvider>
  </HostBridgeProvider>
);
