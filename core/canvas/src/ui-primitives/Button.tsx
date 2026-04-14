import type { ButtonProps } from '@vibe-ctl/plugin-api';
import type { CSSProperties, FC } from 'react';

export type { ButtonProps };

const baseStyle: CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: 6,
  padding: '4px 10px',
  border: '1px solid transparent',
  borderRadius: 4,
  font: 'inherit',
  fontSize: 12,
  cursor: 'pointer',
};

const variants: Record<NonNullable<ButtonProps['variant']>, CSSProperties> = {
  primary: {
    background: '#4f46e5',
    color: '#fff',
    borderColor: '#4338ca',
  },
  secondary: {
    background: 'rgba(127,127,127,0.15)',
    color: 'inherit',
    borderColor: 'rgba(127,127,127,0.35)',
  },
  ghost: {
    background: 'transparent',
    color: 'inherit',
    borderColor: 'transparent',
  },
};

export const Button: FC<ButtonProps> = ({
  variant = 'secondary',
  icon,
  disabled = false,
  onClick,
  children,
}) => {
  const style: CSSProperties = {
    ...baseStyle,
    ...(variants[variant] ?? variants.secondary),
    opacity: disabled ? 0.5 : 1,
    cursor: disabled ? 'not-allowed' : 'pointer',
  };
  return (
    <button type="button" style={style} onClick={onClick} disabled={disabled}>
      {icon ? (
        <span aria-hidden style={{ fontSize: 14 }}>
          {icon}
        </span>
      ) : null}
      <span>{children}</span>
    </button>
  );
};
