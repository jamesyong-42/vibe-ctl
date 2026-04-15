/**
 * Loading screen. Rendered by the screen router while boot tasks run
 * (plugin discovery, version compat check, update probe). Flips to
 * `main` (or `onboarding` / `version-gate`) once tasks complete.
 */

import type { FC } from 'react';
import { ProgressBar } from './ProgressBar.js';
import { TaskList } from './TaskList.js';
import { useBootTasks } from './useBootTasks.js';

export interface LoadingScreenProps {
  /** Called when all boot tasks finish. Router uses this to transition. */
  onReady?: () => void;
}

export const LoadingScreen: FC<LoadingScreenProps> = ({ onReady }) => {
  const { tasks, progress, done } = useBootTasks();

  if (done && onReady) {
    // Fire-and-forget transition signal; router flips screens on the
    // next render.
    queueMicrotask(onReady);
  }

  return (
    <div className="flex h-screen w-screen items-center justify-center bg-neutral-50 dark:bg-neutral-900">
      <div className="flex w-80 flex-col gap-4">
        <div>
          <div className="mb-1 font-semibold text-neutral-800 text-sm dark:text-neutral-200">
            vibe-ctl
          </div>
          <ProgressBar value={progress} />
        </div>
        <TaskList tasks={tasks} />
      </div>
    </div>
  );
};
