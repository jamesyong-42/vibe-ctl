import { useEffect, useState } from 'react';

export interface BootTask {
  id: string;
  label: string;
  status: 'pending' | 'running' | 'done' | 'error';
  error?: string;
}

export interface BootState {
  tasks: BootTask[];
  progress: number;
  done: boolean;
}

const INITIAL_TASKS: BootTask[] = [
  { id: 'sync-fabric', label: 'Start sync fabric', status: 'pending' },
  { id: 'version-check', label: 'Check version compatibility', status: 'pending' },
  { id: 'plugins', label: 'Load plugins', status: 'pending' },
  { id: 'updates', label: 'Check for updates', status: 'pending' },
];

/**
 * Boot task orchestrator — placeholder state machine. Real
 * implementation will subscribe to main-process events over IPC and
 * drive each task's status from actual runtime signals.
 *
 * Exposed as a hook so the loading screen can render a live progress
 * list and the screen router can flip to `main` when `done` is true.
 */
export function useBootTasks(): BootState {
  const [tasks, setTasks] = useState<BootTask[]>(INITIAL_TASKS);

  useEffect(() => {
    // TODO: replace with IPC subscription. For now, fake-progress
    // through each task at ~250ms so the loading UI is visible.
    let cancelled = false;
    (async () => {
      for (const task of INITIAL_TASKS) {
        if (cancelled) return;
        setTasks((prev) => prev.map((t) => (t.id === task.id ? { ...t, status: 'running' } : t)));
        await new Promise((resolve) => setTimeout(resolve, 250));
        if (cancelled) return;
        setTasks((prev) => prev.map((t) => (t.id === task.id ? { ...t, status: 'done' } : t)));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const completed = tasks.filter((t) => t.status === 'done').length;
  const progress = tasks.length === 0 ? 1 : completed / tasks.length;
  const done = tasks.every((t) => t.status === 'done');

  return { tasks, progress, done };
}
