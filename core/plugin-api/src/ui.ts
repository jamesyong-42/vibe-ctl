import type { FC, ReactNode } from 'react';

/**
 * Host-provided UI primitives. Runtime components are injected by the
 * kernel through `ctx.ui`; this package only declares their shapes so
 * the plugin-api stays React-agnostic at runtime.
 *
 * Plugins call these through `ctx.ui` or the `useUI()` hook — never
 * import them directly from this package (there's nothing to import).
 */

export interface PanelProps {
  title?: string;
  toolbar?: ReactNode;
  children: ReactNode;
}

export interface ButtonProps {
  variant?: 'primary' | 'secondary' | 'ghost';
  icon?: string;
  disabled?: boolean;
  onClick: () => void;
  children: ReactNode;
}

export interface InputProps {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  disabled?: boolean;
}

export interface SelectOption {
  value: string;
  label: string;
}

export interface SelectProps {
  value: string;
  options: SelectOption[];
  onChange: (v: string) => void;
  disabled?: boolean;
}

export interface ListProps {
  items: unknown[];
  renderItem: (item: unknown, index: number) => ReactNode;
}

export interface ListItemProps {
  label: string;
  sublabel?: string;
  icon?: string;
  selected?: boolean;
  onClick?: () => void;
}

export interface ModalProps {
  title: string;
  open: boolean;
  onClose: () => void;
  children: ReactNode;
}

export interface TooltipProps {
  content: string;
  children: ReactNode;
}

export interface IconProps {
  name: string;
  size?: number;
}

export interface BadgeProps {
  variant?: 'default' | 'success' | 'warn' | 'error';
  children: ReactNode;
}

export interface SpinnerProps {
  size?: number;
}

/**
 * Collection of host-provided components exposed via `ctx.ui`.
 */
export interface UI {
  Panel: FC<PanelProps>;
  Button: FC<ButtonProps>;
  Input: FC<InputProps>;
  Select: FC<SelectProps>;
  List: FC<ListProps>;
  ListItem: FC<ListItemProps>;
  Modal: FC<ModalProps>;
  Tooltip: FC<TooltipProps>;
  Icon: FC<IconProps>;
  Badge: FC<BadgeProps>;
  Spinner: FC<SpinnerProps>;
  Separator: FC;
}
