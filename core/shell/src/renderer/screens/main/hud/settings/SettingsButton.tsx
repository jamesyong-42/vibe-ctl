import { FloatingButton, SettingsIcon } from '@vibe-ctl/ui';
import type { FC } from 'react';

export interface SettingsButtonProps {
  active: boolean;
  onClick: () => void;
}

/**
 * Bottom-left HUD FAB for the settings feature. Stateless — visual
 * `active` flag plus click handler, both supplied by the parent
 * feature entry (`Settings`). Panel visibility belongs to
 * `useSettingsPanel`, not this button.
 */
export const SettingsButton: FC<SettingsButtonProps> = ({ active, onClick }) => (
  <FloatingButton
    onClick={onClick}
    title="Settings"
    active={active}
    className="absolute bottom-4 left-4"
  >
    <SettingsIcon />
  </FloatingButton>
);
