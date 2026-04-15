import type { FC } from 'react';

export interface ProgressBarProps {
  /** Value in [0, 1]. Clamped on render. */
  value: number;
}

/**
 * Tiny loading-bar. Uses the native `<progress>` element so a11y
 * (role, value, announce) is automatic and no extra keyboard/focus
 * affordances are needed.
 */
export const ProgressBar: FC<ProgressBarProps> = ({ value }) => {
  const clamped = Math.max(0, Math.min(1, value));
  return (
    <progress
      value={clamped}
      max={1}
      className="h-1 w-full appearance-none overflow-hidden rounded-full bg-neutral-200 [&::-moz-progress-bar]:bg-neutral-800 [&::-webkit-progress-bar]:bg-neutral-200 [&::-webkit-progress-value]:bg-neutral-800 [&::-webkit-progress-value]:transition-[width] [&::-webkit-progress-value]:duration-200 [&::-webkit-progress-value]:ease-out dark:bg-neutral-800 dark:[&::-moz-progress-bar]:bg-neutral-200 dark:[&::-webkit-progress-bar]:bg-neutral-800 dark:[&::-webkit-progress-value]:bg-neutral-200"
    />
  );
};
