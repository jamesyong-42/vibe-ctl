import type { ModalProps } from '@vibe-ctl/extension-api';
import type { CSSProperties, FC } from 'react';

export type { ModalProps };

const backdropStyle: CSSProperties = {
  position: 'fixed',
  inset: 0,
  background: 'rgba(0,0,0,0.4)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  zIndex: 1000,
};

const dialogStyle: CSSProperties = {
  minWidth: 320,
  maxWidth: '80vw',
  maxHeight: '80vh',
  display: 'flex',
  flexDirection: 'column',
  background: '#1f1f23',
  color: '#fff',
  border: '1px solid rgba(255,255,255,0.1)',
  borderRadius: 8,
  boxShadow: '0 10px 30px rgba(0,0,0,0.4)',
  overflow: 'hidden',
};

const headerStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  padding: '10px 14px',
  borderBottom: '1px solid rgba(255,255,255,0.1)',
  fontSize: 13,
  fontWeight: 600,
};

const closeBtnStyle: CSSProperties = {
  background: 'transparent',
  border: 'none',
  color: 'inherit',
  cursor: 'pointer',
  fontSize: 16,
  lineHeight: 1,
};

const bodyStyle: CSSProperties = {
  flex: 1,
  minHeight: 0,
  overflow: 'auto',
  padding: 14,
};

export const Modal: FC<ModalProps> = ({ title, open, onClose, children }) => {
  if (!open) return null;
  return (
    <div style={backdropStyle} onClick={onClose} role="presentation">
      <div
        style={dialogStyle}
        role="dialog"
        aria-label={title}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={headerStyle}>
          <span>{title}</span>
          <button type="button" style={closeBtnStyle} onClick={onClose} aria-label="Close">
            ×
          </button>
        </div>
        <div style={bodyStyle}>{children}</div>
      </div>
    </div>
  );
};
