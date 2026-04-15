import type { FC } from 'react';
import type { BootTask } from './useBootTasks.js';

export interface TaskListProps {
  tasks: BootTask[];
}

const statusGlyph: Record<BootTask['status'], string> = {
  pending: '○',
  running: '◐',
  done: '●',
  error: '✕',
};

const statusColor: Record<BootTask['status'], string> = {
  pending: 'text-neutral-400 dark:text-neutral-600',
  running: 'text-blue-500',
  done: 'text-emerald-500',
  error: 'text-red-500',
};

export const TaskList: FC<TaskListProps> = ({ tasks }) => (
  <ul className="flex flex-col gap-1 font-mono text-[11px]">
    {tasks.map((task) => (
      <li key={task.id} className="flex items-center gap-2">
        <span className={`w-4 text-center ${statusColor[task.status]}`}>
          {statusGlyph[task.status]}
        </span>
        <span className="text-neutral-600 dark:text-neutral-400">{task.label}</span>
        {task.error && <span className="ml-2 text-red-500">{task.error}</span>}
      </li>
    ))}
  </ul>
);
