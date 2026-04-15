import type { FC, ReactNode } from 'react';

export interface FloatingButtonProps {
  onClick: () => void;
  title: string;
  active?: boolean;
  disabled?: boolean;
  className?: string;
  children: ReactNode;
}

/**
 * Round 40×40 floating action button. The visual primitive every shell
 * FAB composes (theme toggle, settings, inspector, back button, dock
 * items). Consumer decides absolute positioning via `className`.
 *
 * `no-drag` is an Electron `-webkit-app-region: no-drag` opt-out; a
 * non-Electron host can ignore it — the CSS property is no-op on the
 * web.
 */
export const FloatingButton: FC<FloatingButtonProps> = ({
  onClick,
  title,
  active,
  disabled,
  className,
  children,
}) => {
  const activeCls = active
    ? 'bg-neutral-800 text-white dark:bg-white dark:text-neutral-800'
    : 'bg-white text-neutral-500 hover:bg-neutral-100 hover:text-neutral-700 dark:bg-neutral-800 dark:text-neutral-400 dark:hover:bg-neutral-700 dark:hover:text-neutral-200';
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      disabled={disabled}
      className={`no-drag z-50 flex h-10 w-10 items-center justify-center rounded-full shadow-lg transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${activeCls} ${className ?? ''}`}
    >
      {children}
    </button>
  );
};
