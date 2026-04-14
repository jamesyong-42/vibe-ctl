/**
 * Shell App component.
 *
 * Layout skeleton only — every interior region is a placement that
 * plugins contribute widgets into. Placement components will be imported
 * from `@vibe-ctl/canvas/placements/*` once that module ships its React
 * surface; for now we render local stubs that reserve the layout regions.
 *
 * Responsibilities owned here:
 *   - Wrap the chrome in the <VersionGate /> so a blocking update-required
 *     screen supersedes every placement if the kernel version is behind
 *     any peer (spec 02 §4.1).
 *   - Mount the onboarding inventory banner (spec 02 §9, first-run diff).
 *   - Reserve placement slots: canvas, side-panel-left, side-panel-right,
 *     status-bar, command-palette overlay.
 */

import type { ReactNode } from 'react';
import { InventoryBanner } from './onboarding/InventoryBanner.js';
import { VersionGate } from './version-gate/VersionGate.js';

/** Layout region stub. Replaced by placement components from `@vibe-ctl/canvas`. */
function Placement({
  id,
  children,
  style,
}: {
  id: string;
  children?: ReactNode;
  style?: React.CSSProperties;
}): React.JSX.Element {
  return (
    <div
      data-placement={id}
      style={{
        border: '1px dashed rgba(255,255,255,0.08)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: 'rgba(255,255,255,0.35)',
        fontSize: 12,
        ...style,
      }}
    >
      {children ?? id}
    </div>
  );
}

export function App(): React.JSX.Element {
  return (
    <VersionGate>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '240px 1fr 320px',
          gridTemplateRows: '1fr 28px',
          gridTemplateAreas: `
            "left canvas right"
            "status status status"
          `,
          height: '100vh',
          width: '100vw',
        }}
      >
        <InventoryBanner />
        <Placement id="side-panel-left" style={{ gridArea: 'left' }} />
        <Placement id="canvas" style={{ gridArea: 'canvas' }}>
          canvas (infinite-canvas substrate mounts here)
        </Placement>
        <Placement id="side-panel-right" style={{ gridArea: 'right' }} />
        <Placement id="status-bar" style={{ gridArea: 'status' }} />
        {/* Command palette is an overlay placement, toggled by Cmd+K. */}
      </div>
    </VersionGate>
  );
}
