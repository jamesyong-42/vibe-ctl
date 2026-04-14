# 06 -- Terminal System

> Avocado integration, xterm-r3f rendering, instance pooling, PTY management.
> This is a Layer 4 service -- manages terminal sessions locally and across mesh.

**Depends on:** `01-foundation.md`, `02-electron-shell.md`, `03-ipc-protocol.md`
**Used by:** `05-canvas-widgets.md` (terminal widget), `07-mesh-network.md` (remote terminals)

---

## 1. Architecture

```
Renderer (React)                    Main Process               PTY Worker (utilityProcess)
+-------------------+              +-----------------+         +-------------------+
| TerminalWidget    |              | TerminalService |         | PTYSessionManager |
|  - xterm-r3f      |  MessagePort |  - routes data  | MsgPort |  - LocalPTYSession|
|  - from pool      | <==========>|  - manages pool | <=====> |  - node-pty spawn |
|  - breakpoint LOD |              |  - mesh bridge  |         |  - output buffer  |
+-------------------+              +-----------------+         +-------------------+
                                          |
                                    Truffle Worker
                                   (mesh transport)
                                          |
                                   Remote Terminals
```

### Why This Separation?

1. **PTY Worker** (utilityProcess): Spawns node-pty processes. Isolated because
   PTY crashes, zombie processes, or native module segfaults must not take
   down the main process.

2. **Terminal Service** (main process): Thin routing layer. Connects PTY worker
   output to renderer via MessagePort. Bridges local sessions to mesh network
   via avocado transport-truffle.

3. **Renderer**: Pure display. xterm.js instances from pool receive data via
   MessagePort. No node-pty or avocado code in renderer.

## 2. Terminal Service

```typescript
class TerminalService {
  private ptyWorker: Electron.UtilityProcess;
  private ptyPort: MessagePortMain;           // Main <-> PTY worker
  private rendererPorts: Map<string, MessagePortMain>;  // windowId -> port
  private sessions: Map<string, TerminalSessionInfo>;

  async start() {
    // 1. Spawn PTY worker
    this.ptyWorker = utilityProcess.fork(
      join(__dirname, 'workers/pty-worker.js')
    );

    // 2. Establish MessagePort channel
    const { port1, port2 } = new MessageChannelMain();
    this.ptyPort = port1;
    this.ptyWorker.postMessage({ type: 'set-port' }, [port2]);

    // 3. Listen for PTY output
    this.ptyPort.on('message', (event) => {
      const msg = event.data;
      switch (msg.type) {
        case 'pty-output':
          this.routeOutput(msg.sessionId, msg.data);
          break;
        case 'pty-exit':
          this.handleSessionExit(msg.sessionId, msg.exitCode);
          break;
        case 'pty-error':
          this.handleSessionError(msg.sessionId, msg.error);
          break;
      }
    });
  }

  // Route terminal output to the correct renderer window
  private routeOutput(sessionId: string, data: Uint8Array) {
    for (const [windowId, port] of this.rendererPorts) {
      port.postMessage({ type: 'output', sessionId, data });
    }
    // Also bridge to mesh if session is shared
    this.meshBridge?.forwardOutput(sessionId, data);
  }

  // --- Public API (called by tRPC router) ---

  async createSession(opts: CreateTerminalOpts): Promise<TerminalSessionInfo> {
    const sessionId = crypto.randomUUID();
    this.ptyPort.postMessage({
      type: 'create',
      sessionId,
      config: {
        cwd: opts.cwd ?? app.getPath('home'),
        shell: opts.shell ?? process.env.SHELL ?? '/bin/zsh',
        cols: opts.cols ?? 80,
        rows: opts.rows ?? 24,
        env: { ...process.env, TERM: 'xterm-256color' },
      },
    });

    const session: TerminalSessionInfo = {
      id: sessionId,
      state: 'running',
      cwd: opts.cwd ?? app.getPath('home'),
      created: new Date().toISOString(),
      isLocal: true,
    };
    this.sessions.set(sessionId, session);
    return session;
  }

  getSessions(): TerminalSessionInfo[] {
    return Array.from(this.sessions.values());
  }

  write(sessionId: string, data: string | Uint8Array) {
    this.ptyPort.postMessage({ type: 'write', sessionId, data });
  }

  resize(sessionId: string, cols: number, rows: number) {
    this.ptyPort.postMessage({ type: 'resize', sessionId, cols, rows });
  }

  killSession(sessionId: string) {
    this.ptyPort.postMessage({ type: 'kill', sessionId });
  }

  // Connect a renderer window's MessagePort for terminal data
  registerRendererPort(windowId: string, port: MessagePortMain) {
    this.rendererPorts.set(windowId, port);
    port.start();
  }
}
```

## 3. Terminal Instance Pool (Renderer)

xterm.js instances are expensive (DOM nodes, WebGL context via xterm-r3f).
We pool them to limit memory usage.

```typescript
interface PooledTerminal {
  terminal: Terminal;          // xterm.js Terminal instance
  attachedTo: string | null;   // sessionId currently displayed, or null if free
  lastUsed: number;            // timestamp for LRU eviction
}

class TerminalPool {
  private pool: PooledTerminal[] = [];
  private maxSize: number;

  constructor(opts: { maxInstances: number }) {
    this.maxSize = opts.maxInstances;  // Default: 10
  }

  // Attach a terminal instance to a session
  attach(sessionId: string): Terminal | null {
    // 1. Check if already attached
    const existing = this.pool.find(p => p.attachedTo === sessionId);
    if (existing) {
      existing.lastUsed = Date.now();
      return existing.terminal;
    }

    // 2. Try to get a free instance
    let entry = this.pool.find(p => p.attachedTo === null);

    // 3. If no free instance, evict LRU
    if (!entry && this.pool.length >= this.maxSize) {
      entry = this.pool.sort((a, b) => a.lastUsed - b.lastUsed)[0];
      this.detach(entry.attachedTo!);
    }

    // 4. If still no entry, create new instance
    if (!entry) {
      const terminal = new Terminal({
        allowProposedApi: true,
        fontSize: 14,
        fontFamily: 'JetBrains Mono, Menlo, monospace',
        theme: { background: '#1a1a2e' },
      });
      entry = { terminal, attachedTo: null, lastUsed: 0 };
      this.pool.push(entry);
    }

    entry.attachedTo = sessionId;
    entry.lastUsed = Date.now();

    // Replay output buffer for this session
    const buffer = outputBuffers.get(sessionId);
    if (buffer) {
      entry.terminal.write(buffer);
    }

    return entry.terminal;
  }

  // Detach a terminal instance (release back to pool)
  detach(sessionId: string) {
    const entry = this.pool.find(p => p.attachedTo === sessionId);
    if (entry) {
      entry.terminal.clear();
      entry.attachedTo = null;
    }
  }

  getTerminal(sessionId: string): Terminal | null {
    return this.pool.find(p => p.attachedTo === sessionId)?.terminal ?? null;
  }
}
```

## 4. Output Buffering

When a terminal is not attached to an xterm instance (off-screen or at low zoom),
we still buffer output so it can be replayed when the user zooms in.

```typescript
class OutputBufferManager {
  private buffers = new Map<string, CircularBuffer>();
  private maxPerSession = 1024 * 1024;  // 1MB per session

  onOutput(sessionId: string, data: Uint8Array) {
    let buffer = this.buffers.get(sessionId);
    if (!buffer) {
      buffer = new CircularBuffer(this.maxPerSession);
      this.buffers.set(sessionId, buffer);
    }
    buffer.push(data);

    // Also store "last line" for compact breakpoint rendering
    this.updateLastLine(sessionId, data);
  }

  getBuffer(sessionId: string): Uint8Array | null {
    return this.buffers.get(sessionId)?.getAll() ?? null;
  }

  getLastLine(sessionId: string): string {
    return this.lastLines.get(sessionId) ?? '';
  }
}
```

## 5. Renderer Terminal Data Flow

```typescript
// In renderer: receive terminal data via MessagePort
function useTerminalPort() {
  const portRef = useRef<MessagePort | null>(null);
  const pool = useTerminalPool();
  const buffers = useOutputBufferManager();

  useEffect(() => {
    // Listen for MessagePort from main process
    window.electronAPI.onTerminalPort((port: MessagePort) => {
      portRef.current = port;
      port.onmessage = (event) => {
        const { type, sessionId, data } = event.data;
        if (type === 'output') {
          // 1. Always buffer
          buffers.onOutput(sessionId, data);

          // 2. If terminal attached, write directly (no React re-render)
          const terminal = pool.getTerminal(sessionId);
          if (terminal) {
            terminal.write(data);
          }
        }
      };
    });
  }, []);

  // Send input
  const write = useCallback((sessionId: string, data: string) => {
    portRef.current?.postMessage({ type: 'write', sessionId, data });
  }, []);

  return { write };
}
```

## 6. xterm-r3f Integration

For terminals rendered on the infinite canvas (WebGL):

```typescript
function CanvasTerminalView({ sessionId, width, height }: Props) {
  const pool = useTerminalPool();
  const terminal = pool.attach(sessionId);

  if (!terminal) return <TerminalPlaceholder />;

  // Use xterm-r3f to render terminal in WebGL
  // The terminal widget is a DOM surface on the canvas,
  // but xterm-r3f renders the terminal content via WebGL internally
  return (
    <div style={{ width, height }} className="terminal-container">
      <XTermRenderer
        terminal={terminal}
        pixelRatio={window.devicePixelRatio}
      />
    </div>
  );
}
```

For pop-out windows, use a standard xterm.js DOM renderer (no WebGL):

```typescript
function DetachedTerminalView({ sessionId }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const pool = useTerminalPool();

  useEffect(() => {
    const terminal = pool.attach(sessionId);
    if (terminal && containerRef.current) {
      terminal.open(containerRef.current);
      // Use fit addon for auto-resize
      const fitAddon = new FitAddon();
      terminal.loadAddon(fitAddon);
      fitAddon.fit();
    }
    return () => pool.detach(sessionId);
  }, [sessionId]);

  return <div ref={containerRef} className="h-full w-full" />;
}
```

## 7. Remote Terminal Sessions

When mesh network is active, remote terminals are discovered via avocado's
PTYSyncStore and rendered the same way as local terminals:

```typescript
// Avocado MeshPTYTransport provides IPTYSession interface
// Remote sessions appear in TerminalService.getSessions() alongside local ones
// Data flows: remote PTY -> truffle mesh -> avocado transport -> TerminalService -> renderer

interface TerminalSessionInfo {
  id: string;
  state: 'running' | 'exited' | 'error';
  cwd: string;
  created: string;
  isLocal: boolean;
  deviceId?: string;        // Set for remote sessions
  deviceName?: string;
}
```

See `07-mesh-network.md` for mesh terminal sync details.

---

## Open Questions

- [ ] Should xterm-r3f render on a WebGL surface or DOM surface in the infinite canvas?
  (DOM is simpler; WebGL gives zoom independence but adds complexity)
- [ ] How to handle terminal resize when widget is resized on canvas?
  (Debounce resize events? Resize only on mouse-up?)
- [ ] Should we use xterm.js v6 addons (WebGL addon, fit addon, weblinks addon)?
- [ ] What shell should be default? Detect user's default shell from `$SHELL`?
- [ ] Should terminal output be indexed by spaghetti for searchability?
- [ ] How to handle terminal sessions that outlive the app (background PTY)?
- [ ] Pool size of 10 -- is this enough? Needs profiling on target hardware.
