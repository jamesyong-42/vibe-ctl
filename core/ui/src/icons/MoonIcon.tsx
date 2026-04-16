import type { FC } from 'react';
import { defaultIconProps, type SvgIconProps } from './types.js';

export const MoonIcon: FC<SvgIconProps> = ({ size = 18, ...rest }) => (
  <svg {...defaultIconProps} width={size} height={size} {...rest}>
    <title>Moon</title>
    <path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z" />
  </svg>
);
