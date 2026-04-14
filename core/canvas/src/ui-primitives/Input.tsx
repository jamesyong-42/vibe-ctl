import type { InputProps } from '@vibe-ctl/plugin-api';
import type { CSSProperties, FC } from 'react';

export type { InputProps };

const style: CSSProperties = {
  width: '100%',
  padding: '4px 8px',
  borderRadius: 4,
  border: '1px solid rgba(127,127,127,0.35)',
  background: 'rgba(255,255,255,0.04)',
  color: 'inherit',
  font: 'inherit',
  fontSize: 12,
  boxSizing: 'border-box',
};

export const Input: FC<InputProps> = ({ value, onChange, placeholder, disabled = false }) => {
  return (
    <input
      type="text"
      value={value}
      placeholder={placeholder}
      disabled={disabled}
      style={{ ...style, opacity: disabled ? 0.5 : 1 }}
      onChange={(e) => onChange(e.target.value)}
    />
  );
};
