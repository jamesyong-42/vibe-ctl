/**
 * BootScreen — rendered while the preload handshake is in flight.
 *
 * Intentionally minimal: no strings, no branding, no progress bar.
 * The whole screen is the canvas background colour plus a tiny
 * rotating dot; anything richer belongs on `LoadingScreen` which
 * renders once the handshake resolves.
 */

import type { FC } from 'react';

export const BootScreen: FC = () => (
  <div
    style={{
      position: 'fixed',
      inset: 0,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'var(--canvas-bg, #171717)',
    }}
  >
    <div
      aria-hidden="true"
      style={{
        width: 24,
        height: 24,
        borderRadius: '50%',
        border: '2px solid rgba(255,255,255,0.12)',
        borderTopColor: 'rgba(255,255,255,0.6)',
        animation: 'vibe-boot-spin 0.9s linear infinite',
      }}
    />
    <style>{'@keyframes vibe-boot-spin { to { transform: rotate(360deg); } }'}</style>
  </div>
);
