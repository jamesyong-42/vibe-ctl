/**
 * Root composition. Renders as a layout diagram:
 *
 *   <AppProviders>
 *     <DragRegion/>        Electron-only chrome above every screen
 *     <ScreenRouter/>      Active screen (loading / onboarding / main / version-gate)
 *   </AppProviders>
 *
 * `DragRegion` lives above the router so it stays usable on every
 * screen including full-screen overlays; it's `pointer-events` off
 * everywhere except the drag-region rect, so it doesn't eat clicks.
 */

import type { FC } from 'react';
import { DragRegion } from '../chrome/DragRegion.js';
import { AppProviders } from './providers.js';
import { ScreenRouter } from './screen-router.js';

export const Root: FC = () => (
  <AppProviders>
    <DragRegion />
    <ScreenRouter />
  </AppProviders>
);
