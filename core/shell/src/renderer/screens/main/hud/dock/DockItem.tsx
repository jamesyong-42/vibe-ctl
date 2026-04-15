import type { FC, ReactNode } from 'react';

export interface DockItemProps {
  label: string;
  active: boolean;
  onClick: () => void;
  children: ReactNode;
}

/**
 * One icon slot in the Dock. Square with rounded corners; active state
 * lifts/glows like macOS dock and Figma toolbar items.
 */
export const DockItem: FC<DockItemProps> = ({ label, active, onClick, children }) => (
  <button
    type="button"
    onClick={onClick}
    title={label}
    aria-label={label}
    className={`no-drag flex h-10 w-10 items-center justify-center rounded-lg transition-all ${
      active
        ? 'bg-neutral-800 text-white dark:bg-white dark:text-neutral-800'
        : 'text-neutral-500 hover:bg-neutral-100 hover:text-neutral-700 dark:text-neutral-400 dark:hover:bg-neutral-700 dark:hover:text-neutral-200'
    }`}
  >
    {children}
  </button>
);
