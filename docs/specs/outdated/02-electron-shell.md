# 02 -- Electron Shell

> Process architecture, window management, app lifecycle.
> This is Layer 2 -- the runtime container for everything.

**Depends on:** `01-foundation.md`
**Blocks:** `03-ipc-protocol.md`, all service specs

---

## 1. Process Architecture

```
Main Process (Node.js 24, ESM)
|
|-- App Lifecycle (ready, activate, before-quit)
|-- Window Manager (create, focus, restore, pop-out)
|-- Service Registry (agent, terminal, mesh, notification, canvas)
|-- tRPC Server (electron-trpc, serves all renderers)
|-- Canvas Persistence (debounced autosave)
|-- Menu Builder (app menu, context menus)
|-- System Tray (icon + badge + status menu)
|
+-- utilityProcess: truffle-worker
|     Entry: src/main/workers/truffle-worker.ts
|     Role: Mesh networking (NapiNode), device discovery
|     IPC: MessagePort <-> main
|     Why isolated: Rust tokio runtime + Go sidecar shouldn't block main
|
+-- utilityProcess: pty-worker
|     Entry: src/main/workers/pty-worker.ts
|     Role: PTY session management (node-pty), avocado core
|     IPC: MessagePort <-> main (high-throughput terminal data)
|     Why isolated: PTY crashes shouldn't take down the app
|
+-- child_process: NotchHelper (macOS only)
|     Binary: apps/notch/.build/release/NotchHelper
|     IPC: stdin/stdout JSON lines
|     Why child_process: Standalone Swift binary, not a Node module
|
+-- BrowserWindow: main-canvas
|     URL: renderer/index.html
|     Role: Primary UI -- infinite canvas with widgets
|     IPC: tRPC client via contextBridge
|
+-- BrowserWindow: detached-* (0..N, optional)
      URL: renderer/index.html#/detached/{widgetId}
      Role: Pop-out widgets (terminals, agent detail)
      IPC: Same tRPC client, shared state
```

## 2. Main Process Entry (`src/main/index.ts`)

```typescript
// Lifecycle sketch
import { app, BrowserWindow } from 'electron';
import { createTRPCServer } from './ipc';
import { ServiceRegistry } from './services/registry';
import { WindowManager } from './windows';
import { setupTray } from './tray';
import { setupMenu } from './menu';

app.whenReady().then(async () => {
  // 1. Initialize services
  const services = new ServiceRegistry();
  await services.initialize();

  // 2. Set up tRPC IPC server
  createTRPCServer(services);

  // 3. Create main window
  const windows = new WindowManager();
  windows.createMainWindow();

  // 4. System tray
  setupTray(services, windows);

  // 5. App menu
  setupMenu(services, windows);

  // 6. macOS: Launch notch helper
  if (process.platform === 'darwin') {
    await services.notch.start();
  }
});

app.on('before-quit', async () => {
  await services.shutdown();
});
```

## 3. Service Registry

Central container for all services. Passed to tRPC context.

```typescript
class ServiceRegistry {
  agent: AgentService;         // Wraps spaghetti-core
  terminal: TerminalService;   // Wraps avocado (via pty-worker MessagePort)
  mesh: MeshService;           // Wraps truffle (via truffle-worker MessagePort)
  notification: NotificationService;
  canvas: CanvasPersistenceService;
  notch: NotchService;         // macOS dynamic island

  async initialize() {
    // Order matters: mesh first (discovery), then agent (needs mesh context)
    await this.mesh.start();
    await this.agent.start();
    await this.terminal.start();
    await this.notification.start();
    await this.canvas.load();
  }

  async shutdown() {
    await this.canvas.save();
    await this.terminal.stop();
    await this.agent.stop();
    await this.mesh.stop();
    this.notch?.stop();
  }
}
```

## 4. Window Management

### Main Window

```typescript
function createMainWindow(): BrowserWindow {
  const win = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 800,
    minHeight: 600,
    titleBarStyle: 'hiddenInset',     // macOS: traffic lights in content
    trafficLightPosition: { x: 16, y: 16 },
    vibrancy: 'sidebar',              // macOS: translucent sidebar
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,                 // Needed for some native module access
    },
  });

  // Load renderer
  if (is.dev) {
    win.loadURL(process.env.ELECTRON_RENDERER_URL);
  } else {
    win.loadFile(join(__dirname, '../renderer/index.html'));
  }

  return win;
}
```

### Detached Widget Windows

Pop-out widgets (e.g., a terminal in its own window):

```typescript
function createDetachedWindow(widgetId: string): BrowserWindow {
  const win = new BrowserWindow({
    width: 800,
    height: 600,
    titleBarStyle: 'hiddenInset',
    webPreferences: {
      preload: join(__dirname, '../preload/worker.js'),
      contextIsolation: true,
    },
  });

  const hash = `#/detached/${widgetId}`;
  if (is.dev) {
    win.loadURL(`${process.env.ELECTRON_RENDERER_URL}${hash}`);
  } else {
    win.loadFile(join(__dirname, '../renderer/index.html'), { hash });
  }

  return win;
}
```

### Multi-Monitor Support

- Same canvas state, different viewports per window
- Each window stores its own `{ x, y, zoom }` viewport
- Widget mutations broadcast to all windows via tRPC subscription
- "Pop out" detaches a widget into its own BrowserWindow

## 5. utilityProcess Workers

### Truffle Worker

```typescript
// src/main/workers/truffle-worker.ts
import { NapiNode, type NapiNodeConfig } from '@vibecook/truffle';

// Receive config from main process
process.parentPort.on('message', async (msg) => {
  if (msg.data.type === 'init') {
    const node = new NapiNode();
    await node.start(msg.data.config as NapiNodeConfig);

    // Forward peer events to main
    node.onPeerChange((event) => {
      process.parentPort.postMessage({ type: 'peer-event', event });
    });

    // Forward messages by namespace
    node.onMessage('notify', (msg) => {
      process.parentPort.postMessage({ type: 'mesh-message', namespace: 'notify', msg });
    });

    process.parentPort.postMessage({ type: 'ready' });
  }
});
```

### PTY Worker

```typescript
// src/main/workers/pty-worker.ts
import { PTYSessionManager } from '@avocado/core';
import { LocalPTYSession } from '@avocado/node-pty';

const manager = new PTYSessionManager();

process.parentPort.on('message', async (msg) => {
  switch (msg.data.type) {
    case 'create-session':
      const session = new LocalPTYSession(msg.data.config);
      manager.registerSession(session);
      // Forward output via MessagePort (high throughput)
      session.on('output', (data) => {
        process.parentPort.postMessage({
          type: 'pty-output',
          sessionId: session.id,
          data,  // Binary data, benefits from zero-copy
        });
      });
      break;

    case 'write':
      manager.getSession(msg.data.sessionId)?.write(msg.data.data);
      break;

    case 'resize':
      manager.getSession(msg.data.sessionId)?.resize(msg.data.cols, msg.data.rows);
      break;

    case 'kill':
      manager.getSession(msg.data.sessionId)?.kill();
      break;
  }
});
```

## 6. Preload Script

```typescript
// src/preload/index.ts
import { contextBridge } from 'electron';
import { exposeElectronTRPC } from 'electron-trpc/main';

// Expose tRPC IPC to renderer (type-safe)
exposeElectronTRPC();

// Expose platform info
contextBridge.exposeInMainWorld('platform', {
  os: process.platform,
  arch: process.arch,
});
```

## 7. System Tray

```typescript
function setupTray(services: ServiceRegistry, windows: WindowManager) {
  const tray = new Tray(trayIconPath);

  // Update badge with active agent count
  services.agent.onEvent((event) => {
    const count = services.agent.getActiveCount();
    tray.setTitle(count > 0 ? `${count}` : '');
  });

  tray.on('click', () => windows.toggleMainWindow());

  tray.setContextMenu(Menu.buildFromTemplate([
    { label: 'Show vibe-ctl', click: () => windows.showMainWindow() },
    { type: 'separator' },
    { label: 'Active Agents', enabled: false },
    // Dynamic agent list populated here
    { type: 'separator' },
    { label: 'Settings...', click: () => windows.showSettings() },
    { label: 'Quit', click: () => app.quit() },
  ]));
}
```

## 8. App Menu (macOS)

```typescript
const template: MenuItemConstructorOptions[] = [
  {
    label: app.name,
    submenu: [
      { role: 'about' },
      { type: 'separator' },
      { label: 'Settings...', accelerator: 'CmdOrCtrl+,', click: showSettings },
      { type: 'separator' },
      { role: 'quit' },
    ],
  },
  {
    label: 'View',
    submenu: [
      { label: 'Zoom In', accelerator: 'CmdOrCtrl+=', click: zoomIn },
      { label: 'Zoom Out', accelerator: 'CmdOrCtrl+-', click: zoomOut },
      { label: 'Fit All', accelerator: 'CmdOrCtrl+0', click: fitAll },
      { type: 'separator' },
      { label: 'Toggle Sidebar', accelerator: 'CmdOrCtrl+B', click: toggleSidebar },
      { label: 'Command Palette', accelerator: 'CmdOrCtrl+K', click: showPalette },
    ],
  },
  // ... Edit, Window, Help
];
```

## 9. Security Model

- **Context isolation:** ON (default)
- **Node integration:** OFF in renderer
- **Sandbox:** OFF for preload only (needed for electron-trpc)
- **CSP:** Strict Content-Security-Policy in production
- **safeStorage:** API keys and tokens encrypted via OS keychain
- **ASAR integrity:** Enabled for production builds

---

## Open Questions

- [ ] Should the main window use `WebContentsView` (new API) instead of `BrowserWindow`?
- [ ] How many `utilityProcess` instances before we hit performance issues?
- [ ] Should we use `MessagePort` pairs (pre-established channels) or `parentPort` for workers?
- [ ] Window state restoration: electron-window-state or custom implementation?
- [ ] Should detached windows share the same renderer bundle or have a stripped-down version?
