import type { SpinnerProps } from '@vibe-ctl/extension-api';
import type { CSSProperties, FC } from 'react';

export type { SpinnerProps };

/**
 * CSS-only spinner. No global keyframes injection — uses inline
 * `animation` referring to a name that the host shell is expected to
 * define. The runtime can register `@keyframes vibe-spin` once in its
 * global stylesheet; until then the element renders as a static ring,
 * which is an acceptable fallback.
 */
export const Spinner: FC<SpinnerProps> = ({ size = 16 }) => {
  const style: CSSProperties = {
    display: 'inline-block',
    width: size,
    height: size,
    border: '2px solid rgba(127,127,127,0.3)',
    borderTopColor: 'currentColor',
    borderRadius: '50%',
    animation: 'vibe-spin 0.9s linear infinite',
  };
  return <span aria-label="Loading" role="status" style={style} />;
};
