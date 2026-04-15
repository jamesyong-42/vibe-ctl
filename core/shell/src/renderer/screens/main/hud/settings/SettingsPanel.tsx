import type { FC } from 'react';

export interface SettingsPanelProps {
  onClose: () => void;
}

/**
 * Placeholder settings panel. Real content — preferences, keybindings,
 * mesh setup, plugin manager entry — lands as the feature grows.
 */
export const SettingsPanel: FC<SettingsPanelProps> = ({ onClose }) => (
  <div
    role="dialog"
    aria-label="Settings"
    className="no-drag absolute bottom-20 left-4 z-50 w-72 max-h-[80vh] overflow-y-auto rounded-lg border border-neutral-200 bg-white/95 font-mono text-[11px] shadow-lg backdrop-blur-sm dark:border-neutral-700 dark:bg-neutral-900/95 dark:text-neutral-300"
  >
    <div className="flex items-center justify-between border-b border-neutral-100 px-3 py-2 dark:border-neutral-700">
      <span className="font-semibold text-neutral-700 dark:text-neutral-200">Settings</span>
      <button
        type="button"
        onClick={onClose}
        className="text-neutral-400 hover:text-neutral-600 dark:text-neutral-500 dark:hover:text-neutral-300"
      >
        ×
      </button>
    </div>
    <div className="p-3 text-neutral-500 dark:text-neutral-400">Settings coming soon.</div>
  </div>
);
