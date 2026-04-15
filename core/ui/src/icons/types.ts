import type { SVGProps } from 'react';

/**
 * Props accepted by every icon in the catalog. Mirrors native SVG
 * props so icons can be styled/sized inline via `size` or forwarded
 * props.
 */
export interface SvgIconProps extends Omit<SVGProps<SVGSVGElement>, 'width' | 'height'> {
  size?: number;
}

/** Shared default props for the catalog. Keeps stroke behavior consistent. */
export const defaultIconProps = {
  xmlns: 'http://www.w3.org/2000/svg',
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 2,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
} as const;
