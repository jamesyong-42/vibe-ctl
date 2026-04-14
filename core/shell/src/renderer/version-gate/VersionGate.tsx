/**
 * Blocking "Update required" screen.
 *
 * Spec 02 §4.1: if this kernel's version is below any peer's published
 * `minKernelVersion`, we refuse to start the plugin host or open sync
 * docs for mutation, and render this screen instead.
 *
 * Stub: pure UI; subscribes to a `window.__vibeCtl.versionGate` hook that
 * will be exposed once the preload surface is wired.
 */

import { type ReactNode, useState } from 'react';

export interface VersionGateProps {
  children: ReactNode;
}

export function VersionGate({ children }: VersionGateProps): React.JSX.Element {
  // TODO: subscribe to the main-process version-gate status via IPC.
  const [needsUpdate] = useState<{ required: string; current: string } | null>(null);

  if (!needsUpdate) return <>{children}</>;

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        background: '#0b0b0e',
        color: '#e7e7ea',
        padding: 32,
        textAlign: 'center',
      }}
    >
      <h1 style={{ margin: 0, fontSize: 24 }}>Update required</h1>
      <p style={{ marginTop: 16, maxWidth: 480, opacity: 0.75 }}>
        A newer version of vibe-ctl is running on one of your other devices. To keep your synced
        canvas layout, settings, and permissions safe, please update this device before continuing.
      </p>
      <p style={{ marginTop: 24, fontFamily: 'monospace', opacity: 0.5 }}>
        {needsUpdate.current} → {needsUpdate.required}
      </p>
    </div>
  );
}
