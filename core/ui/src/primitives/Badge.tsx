import type { BadgeProps } from '@vibe-ctl/plugin-api';
import type { CSSProperties, FC } from 'react';

export type { BadgeProps };

const base: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  padding: '1px 6px',
  borderRadius: 10,
  fontSize: 10,
  fontWeight: 600,
  lineHeight: 1.4,
  textTransform: 'uppercase',
  letterSpacing: 0.3,
};

const variants: Record<NonNullable<BadgeProps['variant']>, CSSProperties> = {
  default: { background: 'rgba(127,127,127,0.2)', color: 'inherit' },
  success: { background: 'rgba(34,197,94,0.2)', color: '#16a34a' },
  warn: { background: 'rgba(234,179,8,0.2)', color: '#ca8a04' },
  error: { background: 'rgba(239,68,68,0.2)', color: '#dc2626' },
};

export const Badge: FC<BadgeProps> = ({ variant = 'default', children }) => {
  return <span style={{ ...base, ...(variants[variant] ?? variants.default) }}>{children}</span>;
};
