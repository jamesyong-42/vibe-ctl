import type { FC } from 'react';
import { type SvgIconProps, defaultIconProps } from './types.js';

export interface ChevronIconProps extends SvgIconProps {
  direction?: 'left' | 'right' | 'up' | 'down';
}

const rotations = { right: 0, left: 180, down: 90, up: -90 };

export const ChevronIcon: FC<ChevronIconProps> = ({ size = 12, direction = 'right', ...rest }) => (
  <svg
    {...defaultIconProps}
    width={size}
    height={size}
    style={{ transform: `rotate(${rotations[direction]}deg)` }}
    {...rest}
  >
    <title>Chevron {direction}</title>
    <path d="m9 18 6-6-6-6" />
  </svg>
);
