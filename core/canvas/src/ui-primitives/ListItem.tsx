import type { ListItemProps } from '@vibe-ctl/extension-api';
import type { CSSProperties, FC } from 'react';

export type { ListItemProps };

const rowStyle = (selected: boolean, clickable: boolean): CSSProperties => ({
  display: 'flex',
  alignItems: 'center',
  gap: 8,
  padding: '4px 8px',
  borderRadius: 4,
  cursor: clickable ? 'pointer' : 'default',
  background: selected ? 'rgba(79,70,229,0.2)' : 'transparent',
  color: 'inherit',
  fontSize: 12,
});

const labelStyle: CSSProperties = {
  flex: 1,
  minWidth: 0,
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
};

const sublabelStyle: CSSProperties = {
  opacity: 0.6,
  fontSize: 11,
};

export const ListItem: FC<ListItemProps> = ({
  label,
  sublabel,
  icon,
  onClick,
  selected = false,
}) => {
  const clickable = Boolean(onClick);
  return (
    <div
      style={rowStyle(selected, clickable)}
      onClick={onClick}
      role={clickable ? 'button' : undefined}
      tabIndex={clickable ? 0 : undefined}
      onKeyDown={(e) => {
        if (!clickable) return;
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onClick?.();
        }
      }}
    >
      {icon ? (
        <span aria-hidden style={{ fontSize: 14 }}>
          {icon}
        </span>
      ) : null}
      <span style={labelStyle}>{label}</span>
      {sublabel ? <span style={sublabelStyle}>{sublabel}</span> : null}
    </div>
  );
};
