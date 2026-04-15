/**
 * HUD layer — Layer 2 of the main screen.
 *
 * Reads as a layout diagram: each feature mounts itself. Position is
 * each feature's own concern (top-left navigation, top-right theme,
 * bottom corners for settings/inspector, bottom-center dock). Adding a
 * new HUD feature is a single line here once the feature folder exists.
 */

import type { FC } from 'react';
import { Dock } from './dock/Dock.js';
import { Inspector } from './inspector/Inspector.js';
import { NavigationBar } from './navigation/NavigationBar.js';
import { Settings } from './settings/Settings.js';
import { ThemeToggleButton } from './theme-toggle/ThemeToggleButton.js';

export const HudLayer: FC = () => (
  <>
    <NavigationBar />
    <ThemeToggleButton />
    <Settings />
    <Inspector />
    <Dock />
  </>
);
