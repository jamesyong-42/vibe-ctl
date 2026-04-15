import { useState } from 'react';

/**
 * Open/close state for the settings panel. Kept as its own hook so
 * future features (keybindings, default-panel, sync state) have a
 * natural expansion point.
 */
export function useSettingsPanel() {
  const [isOpen, setIsOpen] = useState(false);
  return {
    isOpen,
    toggle: () => setIsOpen((v) => !v),
    open: () => setIsOpen(true),
    close: () => setIsOpen(false),
  };
}
