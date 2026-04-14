import type { ListProps } from '@vibe-ctl/extension-api';
import type { CSSProperties, FC } from 'react';

export type { ListProps };

const style: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 2,
  margin: 0,
  padding: 0,
  listStyle: 'none',
};

/**
 * The extension-api `ListProps` is non-generic (`items: unknown[]`);
 * callers who need typed item access wrap `List` in their own generic
 * component. Runtime behaviour is a plain map over items.
 */
export const List: FC<ListProps> = ({ items, renderItem }) => {
  return (
    <ul style={style}>
      {items.map((item, idx) => (
        // biome-ignore lint/suspicious/noArrayIndexKey: no stable id on unknown items
        <li key={idx}>{renderItem(item, idx)}</li>
      ))}
    </ul>
  );
};
