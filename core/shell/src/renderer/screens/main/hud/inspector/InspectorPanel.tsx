import type { FC } from 'react';

export interface InspectorPanelProps {
  onClose: () => void;
}

/**
 * Placeholder inspector panel. Will grow into the selected-entity
 * inspector (components, properties, widget config) plus general ECS
 * world browsing.
 */
export const InspectorPanel: FC<InspectorPanelProps> = ({ onClose }) => (
  <div
    role="dialog"
    aria-label="Inspector"
    className="no-drag absolute bottom-20 right-4 z-50 w-72 max-h-[80vh] overflow-y-auto rounded-lg border border-neutral-200 bg-white/95 font-mono text-[11px] shadow-lg backdrop-blur-sm dark:border-neutral-700 dark:bg-neutral-900/95 dark:text-neutral-300"
  >
    <div className="flex items-center justify-between border-b border-neutral-100 px-3 py-2 dark:border-neutral-700">
      <span className="font-semibold text-neutral-700 dark:text-neutral-200">Inspector</span>
      <button
        type="button"
        onClick={onClose}
        className="text-neutral-400 hover:text-neutral-600 dark:text-neutral-500 dark:hover:text-neutral-300"
      >
        ×
      </button>
    </div>
    <div className="p-3 text-neutral-500 dark:text-neutral-400">Inspector coming soon.</div>
  </div>
);
