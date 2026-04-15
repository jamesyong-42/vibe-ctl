import type { FC } from 'react';
import { type SvgIconProps, defaultIconProps } from './types.js';

export const BackIcon: FC<SvgIconProps> = ({ size = 18, ...rest }) => (
  <svg {...defaultIconProps} width={size} height={size} {...rest}>
    <title>Back</title>
    <path d="m15 18-6-6 6-6" />
  </svg>
);
