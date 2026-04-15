import type { DomWidget, EntityId } from '@jamesyong42/infinite-canvas';
import {
  useBreakpoint,
  useIsSelected,
  useUpdateWidget,
  useWidgetData,
} from '@jamesyong42/infinite-canvas';
import { useState } from 'react';
import { z } from 'zod';

const COLOR = '#10b981';

const schema = z.object({
  title: z.string().default('Interactive'),
  note: z.string().default(''),
});

export type DebugInteractiveData = z.infer<typeof schema>;

function DebugInteractiveView({ entityId }: { entityId: EntityId }) {
  const breakpoint = useBreakpoint(entityId);
  const data = useWidgetData<DebugInteractiveData>(entityId);
  const isSelected = useIsSelected(entityId);
  const updateData = useUpdateWidget(entityId);
  const [localCount, setLocalCount] = useState(0);

  const borderColor = isSelected ? '#059669' : COLOR;

  if (breakpoint === 'micro') {
    return (
      <div
        className="flex h-full w-full items-center justify-center font-mono text-[10px] font-bold"
        style={{ border: `2px solid ${COLOR}`, backgroundColor: `${COLOR}15`, color: COLOR }}
      >
        {localCount}
      </div>
    );
  }

  return (
    <div
      className="flex h-full w-full flex-col font-mono text-[11px]"
      style={{ border: `1.5px solid ${borderColor}`, backgroundColor: `${COLOR}06` }}
    >
      <div
        className="flex items-center justify-between px-2 py-1"
        style={{ borderBottom: `1px solid ${COLOR}30`, backgroundColor: `${COLOR}10` }}
      >
        <span style={{ color: COLOR }} className="truncate font-semibold">
          {data.title ?? 'Interactive'}
        </span>
        <span className="text-[9px] text-neutral-400 dark:text-neutral-500">e{entityId}</span>
      </div>
      <div className="flex-1 space-y-1 px-2 py-1.5">
        <button
          type="button"
          className="rounded px-2 py-0.5 font-mono text-[10px] font-medium text-white transition-colors"
          style={{ backgroundColor: COLOR }}
          onClick={(e) => {
            e.stopPropagation();
            setLocalCount((c) => c + 1);
          }}
        >
          click: {localCount}
        </button>
        {(breakpoint === 'expanded' || breakpoint === 'detailed') && (
          <input
            type="text"
            className="w-full rounded border px-1.5 py-0.5 font-mono text-[10px] focus:outline-none"
            style={{ borderColor: `${COLOR}40`, backgroundColor: `${COLOR}05` }}
            placeholder="type here..."
            value={data.note ?? ''}
            onChange={(e) => updateData({ note: e.target.value })}
            onClick={(e) => e.stopPropagation()}
          />
        )}
      </div>
    </div>
  );
}

export const DebugInteractive: DomWidget<DebugInteractiveData> = {
  type: 'debug-interactive',
  schema,
  defaultData: { title: 'Interactive', note: '' },
  defaultSize: { width: 280, height: 200 },
  component: DebugInteractiveView,
};
