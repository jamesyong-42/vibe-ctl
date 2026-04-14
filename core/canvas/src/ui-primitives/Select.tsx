import type { SelectOption, SelectProps } from '@vibe-ctl/extension-api';
import type { CSSProperties, FC } from 'react';

export type { SelectOption, SelectProps };

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

export const Select: FC<SelectProps> = ({ value, options, onChange, disabled = false }) => {
  return (
    <select
      value={value}
      disabled={disabled}
      style={{ ...style, opacity: disabled ? 0.5 : 1 }}
      onChange={(e) => onChange(e.target.value)}
    >
      {options.map((opt) => (
        <option key={opt.value} value={opt.value}>
          {opt.label}
        </option>
      ))}
    </select>
  );
};
