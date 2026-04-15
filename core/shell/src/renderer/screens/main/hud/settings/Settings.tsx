/**
 * Settings feature — composes its own button + panel + state hook so
 * the HUD mount site is a single line (`<Settings/>`).
 */

import type { FC } from 'react';
import { SettingsButton } from './SettingsButton.js';
import { SettingsPanel } from './SettingsPanel.js';
import { useSettingsPanel } from './useSettingsPanel.js';

export const Settings: FC = () => {
  const { isOpen, toggle, close } = useSettingsPanel();
  return (
    <>
      <SettingsButton active={isOpen} onClick={toggle} />
      {isOpen && <SettingsPanel onClose={close} />}
    </>
  );
};
