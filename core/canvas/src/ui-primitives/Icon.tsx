import type { IconProps } from '@vibe-ctl/plugin-api';
import type { CSSProperties, FC } from 'react';

export type { IconProps };

/**
 * Placeholder icon renderer. The runtime resolves `name` against a
 * theme-provided icon set; for now we just render the name inside a
 * monospace span at the requested size. Keeps API stable.
 */
export const Icon: FC<IconProps> = ({ name, size = 16 }) => {
  const style: CSSProperties = {
    display: 'inline-block',
    width: size,
    height: size,
    lineHeight: `${size}px`,
    fontSize: size * 0.75,
    textAlign: 'center',
    fontFamily: 'monospace',
    opacity: 0.8,
  };
  return (
    <span aria-hidden style={style} data-icon={name}>
      {name.slice(0, 2)}
    </span>
  );
};
