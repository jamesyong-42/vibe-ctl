import { ChevronIcon } from '@vibe-ctl/ui';
import type { FC } from 'react';
import type { Crumb } from './useNavigationCrumbs.js';

export interface BreadcrumbsProps {
  crumbs: Crumb[];
  onJump: (depth: number) => void;
}

/**
 * Breadcrumb pill showing the container navigation trail. Clickable
 * ancestors pop back to the matching depth; current crumb is
 * non-interactive. Each crumb clamps to 160px with ellipsis.
 */
export const Breadcrumbs: FC<BreadcrumbsProps> = ({ crumbs, onJump }) => (
  <nav
    aria-label="Navigation breadcrumbs"
    className="no-drag flex items-center gap-0.5 rounded-full bg-white px-3 py-2 font-medium text-[12px] shadow-lg dark:bg-neutral-800"
  >
    {crumbs.map((crumb, i) => {
      const isCurrent = i === crumbs.length - 1;
      const key = `${crumb.depth}-${crumb.containerId ?? 'root'}`;
      return (
        <div key={key} className="flex items-center">
          {i > 0 && (
            <span className="mx-0.5 text-neutral-300 dark:text-neutral-600">
              <ChevronIcon size={12} />
            </span>
          )}
          {isCurrent ? (
            <span
              aria-current="page"
              className="max-w-[160px] truncate rounded px-1.5 py-0.5 text-neutral-800 dark:text-neutral-100"
            >
              {crumb.label}
            </span>
          ) : (
            <button
              type="button"
              onClick={() => onJump(crumb.depth)}
              title={`Jump to ${crumb.label}`}
              className="max-w-[160px] truncate rounded px-1.5 py-0.5 text-neutral-500 transition-colors hover:bg-neutral-100 hover:text-neutral-700 dark:text-neutral-400 dark:hover:bg-neutral-700 dark:hover:text-neutral-200"
            >
              {crumb.label}
            </button>
          )}
        </div>
      );
    })}
  </nav>
);
