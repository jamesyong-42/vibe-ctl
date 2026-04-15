import type { FC } from 'react';

export interface WelcomeStepProps {
  onContinue: () => void;
}

export const WelcomeStep: FC<WelcomeStepProps> = ({ onContinue }) => (
  <div className="flex flex-col items-center gap-6 text-center">
    <div>
      <h1 className="font-semibold text-neutral-900 text-3xl dark:text-neutral-100">
        Welcome to vibe-ctl
      </h1>
      <p className="mt-3 max-w-md text-neutral-600 dark:text-neutral-400">
        One control center for every Claude Code session across every device you own. Let&apos;s get
        you set up.
      </p>
    </div>
    <button
      type="button"
      onClick={onContinue}
      className="rounded-full bg-neutral-900 px-6 py-2 font-medium text-sm text-white transition-colors hover:bg-neutral-700 dark:bg-white dark:text-neutral-900 dark:hover:bg-neutral-200"
    >
      Get started
    </button>
  </div>
);
