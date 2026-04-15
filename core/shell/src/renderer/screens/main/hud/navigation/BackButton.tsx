import { BackIcon, FloatingButton } from '@vibe-ctl/ui';
import type { FC } from 'react';

export interface BackButtonProps {
  disabled: boolean;
  onClick: () => void;
}

/**
 * Round back button. Disabled when the nav stack is at root.
 * Thin wrapper over `FloatingButton` so the button keeps the shell's
 * shared FAB visuals (shadow, hover, dark-mode) without any layout
 * opinions — the parent `NavigationBar` decides where it sits.
 */
export const BackButton: FC<BackButtonProps> = ({ disabled, onClick }) => (
  <FloatingButton
    title={disabled ? 'Already at root' : 'Back (Esc)'}
    disabled={disabled}
    onClick={onClick}
  >
    <BackIcon />
  </FloatingButton>
);
