import type { PanelProps } from '@vibe-ctl/plugin-api';
import type { CSSProperties, FC } from 'react';

export type { PanelProps };

const rootStyle: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  width: '100%',
  height: '100%',
  border: '1px solid rgba(127,127,127,0.25)',
  borderRadius: 6,
  background: 'rgba(255,255,255,0.02)',
  overflow: 'hidden',
  boxSizing: 'border-box',
};

const headerStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  padding: '6px 10px',
  borderBottom: '1px solid rgba(127,127,127,0.2)',
  fontSize: 12,
  fontWeight: 600,
  gap: 8,
};

const bodyStyle: CSSProperties = {
  flex: 1,
  minHeight: 0,
  overflow: 'auto',
  padding: 8,
};

export const Panel: FC<PanelProps> = ({ title, toolbar, children }) => {
  const showHeader = title !== undefined || toolbar !== undefined;
  return (
    <div style={rootStyle}>
      {showHeader ? (
        <div style={headerStyle}>
          <span>{title}</span>
          {toolbar ? <span>{toolbar}</span> : null}
        </div>
      ) : null}
      <div style={bodyStyle}>{children}</div>
    </div>
  );
};
