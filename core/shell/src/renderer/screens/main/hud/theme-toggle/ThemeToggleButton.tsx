import { FloatingButton, MoonIcon, SunIcon } from '@vibe-ctl/ui';
import type { FC } from 'react';
import { useTheme } from '../../../../app/theme/useTheme.js';

/**
 * Top-right HUD FAB. Flips dark mode via the shared theme context.
 * Swaps icon based on the *current* state so the icon shows the
 * *target* state (click Sun while dark → go to light, etc.).
 */
export const ThemeToggleButton: FC = () => {
  const { theme, toggle } = useTheme();
  const dark = theme === 'dark';

  return (
    <FloatingButton
      onClick={toggle}
      title={dark ? 'Switch to light mode' : 'Switch to dark mode'}
      className="absolute top-4 right-4"
    >
      {dark ? <SunIcon /> : <MoonIcon />}
    </FloatingButton>
  );
};
