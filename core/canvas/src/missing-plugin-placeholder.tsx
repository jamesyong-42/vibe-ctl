import type { CSSProperties, FC } from 'react';

/**
 * Rendered in place of a widget when the canvas-layout CRDT references
 * a widget type whose plugin is not installed locally (spec 02 §6.1
 * step "B: Renders MissingPluginPlaceholder").
 *
 * Actions are handed in as props so the runtime can wire them to
 * kernel-owned flows (install from registry, remove widget entry from
 * `kernel/canvas-layout`).
 */
export interface MissingPluginPlaceholderProps {
  /** Plugin id referenced by the orphaned widget. */
  pluginId: string;
  /** Widget type id, e.g. `terminal:session-monitor`. */
  widgetType: string;
  /** Human-readable reason (kernel may fill this from the registry). */
  reason?: string;
  /**
   * Invoked when the user clicks [Install]. Runtime resolves the
   * plugin from the marketplace and activates it. Undefined if install
   * is unavailable (offline, unknown source).
   */
  onInstall?: () => void;
  /**
   * Invoked when the user clicks [Remove]. Runtime deletes the widget
   * entry from `kernel/canvas-layout`. Always available.
   */
  onRemove: () => void;
}

const containerStyle: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
  gap: 8,
  width: '100%',
  height: '100%',
  padding: 16,
  border: '1px dashed rgba(127,127,127,0.5)',
  borderRadius: 8,
  background: 'rgba(127,127,127,0.04)',
  color: 'inherit',
  fontSize: 12,
  textAlign: 'center',
  boxSizing: 'border-box',
};

const iconStyle: CSSProperties = {
  fontSize: 20,
  lineHeight: 1,
};

const titleStyle: CSSProperties = {
  fontWeight: 600,
};

const reasonStyle: CSSProperties = {
  opacity: 0.7,
  maxWidth: '90%',
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
};

const buttonRowStyle: CSSProperties = {
  display: 'flex',
  gap: 6,
  marginTop: 4,
};

const buttonStyle: CSSProperties = {
  padding: '4px 10px',
  borderRadius: 4,
  border: '1px solid currentColor',
  background: 'transparent',
  color: 'inherit',
  font: 'inherit',
  cursor: 'pointer',
};

export const MissingPluginPlaceholder: FC<MissingPluginPlaceholderProps> = ({
  pluginId,
  widgetType,
  reason,
  onInstall,
  onRemove,
}) => {
  return (
    <div style={containerStyle} role="status" aria-label="Missing plugin">
      <span style={iconStyle} aria-hidden>
        ⚠
      </span>
      <span style={titleStyle}>{pluginId} not installed</span>
      <span style={reasonStyle}>{reason ?? `Needed for widget "${widgetType}"`}</span>
      <div style={buttonRowStyle}>
        {onInstall ? (
          <button type="button" style={buttonStyle} onClick={onInstall}>
            Install
          </button>
        ) : null}
        <button type="button" style={buttonStyle} onClick={onRemove}>
          Remove
        </button>
      </div>
    </div>
  );
};
