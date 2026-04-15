import type { TooltipProps } from '@vibe-ctl/plugin-api';
import type { CSSProperties, FC } from 'react';

export type { TooltipProps };

const wrapperStyle: CSSProperties = {
  position: 'relative',
  display: 'inline-flex',
};

/**
 * Minimal tooltip using the native `title` attribute on a span wrapper.
 * The runtime may later swap this for a richer implementation (portal,
 * arrow, delay) without changing the public contract.
 */
export const Tooltip: FC<TooltipProps> = ({ content, children }) => {
  return (
    <span style={wrapperStyle} title={content}>
      {children}
    </span>
  );
};
