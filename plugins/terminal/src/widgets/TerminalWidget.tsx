import type { WidgetProps } from '@vibe-ctl/extension-api';

/**
 * Widget: Terminal.
 *
 * TODO: render an xterm.js surface, subscribe to PTY data from the
 * main half (via RPC) and write user input back.
 */
export function TerminalWidget({ width, height }: WidgetProps) {
  return (
    <div
      style={{
        width,
        height,
        padding: 8,
        background: '#000',
        color: '#eee',
        fontFamily: 'monospace',
      }}
    >
      <h3 style={{ color: '#eee' }}>Terminal</h3>
      <p>TODO: mount xterm.js</p>
    </div>
  );
}
