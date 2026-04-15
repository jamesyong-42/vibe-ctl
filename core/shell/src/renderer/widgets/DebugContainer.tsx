import type { Archetype, DomWidget, EntityId } from '@jamesyong42/infinite-canvas';
import {
  Children,
  Container,
  useBreakpoint,
  useChildren,
  useIsSelected,
  useWidgetData,
} from '@jamesyong42/infinite-canvas';
import { z } from 'zod';

const COLOR = '#8b5cf6';

const schema = z.object({
  title: z.string().default('Container'),
});

export type DebugContainerData = z.infer<typeof schema>;

function DebugContainerView({ entityId }: { entityId: EntityId }) {
  const breakpoint = useBreakpoint(entityId);
  const data = useWidgetData<DebugContainerData>(entityId);
  const isSelected = useIsSelected(entityId);
  const children = useChildren(entityId);

  const borderColor = isSelected ? '#7c3aed' : COLOR;

  if (breakpoint === 'micro') {
    return (
      <div
        className="flex h-full w-full items-center justify-center font-mono text-[10px] font-bold"
        style={{ border: `2px dashed ${COLOR}`, backgroundColor: `${COLOR}10`, color: COLOR }}
      >
        {children.length}
      </div>
    );
  }

  return (
    <div
      className="flex h-full w-full flex-col font-mono text-[11px]"
      style={{ border: `1.5px dashed ${borderColor}`, backgroundColor: `${COLOR}04` }}
    >
      <div
        className="flex items-center justify-between px-2 py-1"
        style={{ borderBottom: `1px dashed ${COLOR}25`, backgroundColor: `${COLOR}08` }}
      >
        <span style={{ color: COLOR }} className="truncate font-semibold">
          {data.title ?? 'Container'}
        </span>
        <span className="text-[9px] text-neutral-400 dark:text-neutral-500">
          e{entityId} [{children.length}]
        </span>
      </div>
      <div className="flex-1 px-2 py-1.5 text-neutral-500 dark:text-neutral-400">
        {(breakpoint === 'expanded' || breakpoint === 'detailed') && (
          <div className="text-[10px]" style={{ color: `${COLOR}80` }}>
            double-click to enter
          </div>
        )}
      </div>
    </div>
  );
}

export const DebugContainer: DomWidget<DebugContainerData> = {
  type: 'debug-container',
  schema,
  defaultData: { title: 'Container' },
  defaultSize: { width: 400, height: 300 },
  component: DebugContainerView,
};

export const DebugContainerArchetype: Archetype = {
  id: 'debug-container',
  widget: 'debug-container',
  components: [
    [Container, { enterable: true }],
    [Children, { ids: [] as EntityId[] }],
  ],
};
