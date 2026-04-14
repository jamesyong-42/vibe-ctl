# 03 -- IPC & Protocol

> tRPC routers, MessagePort channels, state management, cross-process communication.
> This is Layer 3 -- the nervous system connecting all processes.

**Depends on:** `01-foundation.md`, `02-electron-shell.md`
**Blocks:** All service specs (04-08), `05-canvas-widgets.md`

---

## 1. Communication Channels Overview

Not all data flows through the same pipe. Different data has different needs:

| Channel | Transport | Use Case | Throughput | Latency |
|---|---|---|---|---|
| **tRPC over IPC** | `ipcMain.handle` / `ipcRenderer.invoke` | CRUD queries, mutations, subscriptions | Medium | ~1ms |
| **MessagePort** | Structured clone + transferable | Terminal I/O, mesh events | High | <0.5ms |
| **stdin/stdout** | Pipe (JSON lines) | NotchHelper (Swift) | Low | ~5ms |
| **Truffle WS** | WebSocket (mesh network) | Cross-device messaging | Medium | ~10-100ms |

### Why Two IPC Channels?

- **tRPC**: Type-safe, request/response + subscriptions. Perfect for agent queries,
  canvas state, settings, anything that benefits from a structured API.
- **MessagePort**: Raw, fast, supports transferable objects. Essential for terminal
  output (thousands of chunks/sec) and mesh event streams where tRPC overhead
  (serialization, routing, middleware) would be wasteful.

## 2. tRPC Setup

### Server (Main Process)

```typescript
// src/main/ipc.ts
import { createIPCHandler } from 'electron-trpc/main';
import { appRouter, type AppRouter } from '@vibe-ctl/protocol';
import type { ServiceRegistry } from './services/registry';

export function createTRPCServer(services: ServiceRegistry) {
  createIPCHandler({
    router: appRouter,
    createContext: () => ({
      agent: services.agent,
      terminal: services.terminal,
      mesh: services.mesh,
      notification: services.notification,
      canvas: services.canvas,
    }),
  });
}
```

### Client (Renderer)

```typescript
// src/renderer/trpc.ts
import { createTRPCReact } from '@trpc/react-query';
import { ipcLink } from 'electron-trpc/renderer';
import type { AppRouter } from '@vibe-ctl/protocol';

export const trpc = createTRPCReact<AppRouter>();

export const trpcClient = trpc.createClient({
  links: [ipcLink()],
});
```

### Root Router

```typescript
// packages/protocol/src/router.ts
import { router } from './trpc';
import { agentRouter } from './routers/agent';
import { terminalRouter } from './routers/terminal';
import { canvasRouter } from './routers/canvas';
import { deviceRouter } from './routers/device';
import { notificationRouter } from './routers/notification';
import { systemRouter } from './routers/system';

export const appRouter = router({
  agent: agentRouter,
  terminal: terminalRouter,
  canvas: canvasRouter,
  device: deviceRouter,
  notification: notificationRouter,
  system: systemRouter,
});

export type AppRouter = typeof appRouter;
```

## 3. Router Specifications

### Agent Router

```typescript
export const agentRouter = router({
  // Queries
  projects: publicProcedure
    .query(({ ctx }) => ctx.agent.getProjects()),

  sessions: publicProcedure
    .input(z.object({ projectSlug: z.string() }))
    .query(({ ctx, input }) => ctx.agent.getSessions(input.projectSlug)),

  sessionMessages: publicProcedure
    .input(z.object({
      projectSlug: z.string(),
      sessionId: z.string(),
      limit: z.number().default(50),
      offset: z.number().default(0),
    }))
    .query(({ ctx, input }) => ctx.agent.getSessionMessages(input)),

  search: publicProcedure
    .input(z.object({ query: z.string(), limit: z.number().default(20) }))
    .query(({ ctx, input }) => ctx.agent.search(input.query, input.limit)),

  // Mutations
  approve: publicProcedure
    .input(z.object({ sessionId: z.string(), requestId: z.string() }))
    .mutation(({ ctx, input }) => ctx.agent.approveRequest(input)),

  deny: publicProcedure
    .input(z.object({ sessionId: z.string(), requestId: z.string(), reason: z.string().optional() }))
    .mutation(({ ctx, input }) => ctx.agent.denyRequest(input)),

  // Subscriptions
  onEvent: publicProcedure
    .subscription(({ ctx }) => observable<AgentEvent>((emit) => {
      return ctx.agent.subscribe((event) => emit.next(event));
    })),
});
```

### Terminal Router

```typescript
export const terminalRouter = router({
  list: publicProcedure
    .query(({ ctx }) => ctx.terminal.getSessions()),

  create: publicProcedure
    .input(z.object({
      cwd: z.string().optional(),
      shell: z.string().optional(),
      cols: z.number().default(80),
      rows: z.number().default(24),
    }))
    .mutation(({ ctx, input }) => ctx.terminal.createSession(input)),

  kill: publicProcedure
    .input(z.object({ sessionId: z.string() }))
    .mutation(({ ctx, input }) => ctx.terminal.killSession(input.sessionId)),

  resize: publicProcedure
    .input(z.object({ sessionId: z.string(), cols: z.number(), rows: z.number() }))
    .mutation(({ ctx, input }) => ctx.terminal.resize(input)),

  // NOTE: Terminal output does NOT go through tRPC.
  // It uses MessagePort for performance. See section 4.
});
```

### Canvas Router

```typescript
export const canvasRouter = router({
  getState: publicProcedure
    .query(({ ctx }) => ctx.canvas.getState()),

  saveState: publicProcedure
    .input(CanvasStateSchema)
    .mutation(({ ctx, input }) => ctx.canvas.saveState(input)),

  addWidget: publicProcedure
    .input(AddWidgetSchema)
    .mutation(({ ctx, input }) => ctx.canvas.addWidget(input)),

  removeWidget: publicProcedure
    .input(z.object({ widgetId: z.string() }))
    .mutation(({ ctx, input }) => ctx.canvas.removeWidget(input.widgetId)),

  // Subscription for multi-window sync
  onStateChange: publicProcedure
    .subscription(({ ctx }) => observable<CanvasEvent>((emit) => {
      return ctx.canvas.subscribe((event) => emit.next(event));
    })),
});
```

### Device Router

```typescript
export const deviceRouter = router({
  localInfo: publicProcedure
    .query(({ ctx }) => ctx.mesh.getLocalInfo()),

  peers: publicProcedure
    .query(({ ctx }) => ctx.mesh.getPeers()),

  ping: publicProcedure
    .input(z.object({ peerId: z.string() }))
    .mutation(({ ctx, input }) => ctx.mesh.ping(input.peerId)),

  onPeerChange: publicProcedure
    .subscription(({ ctx }) => observable<PeerEvent>((emit) => {
      return ctx.mesh.subscribePeerChanges((event) => emit.next(event));
    })),
});
```

### Notification Router

```typescript
export const notificationRouter = router({
  list: publicProcedure
    .input(z.object({ limit: z.number().default(50), unreadOnly: z.boolean().default(false) }))
    .query(({ ctx, input }) => ctx.notification.getNotifications(input)),

  markRead: publicProcedure
    .input(z.object({ notificationId: z.string() }))
    .mutation(({ ctx, input }) => ctx.notification.markRead(input.notificationId)),

  markAllRead: publicProcedure
    .mutation(({ ctx }) => ctx.notification.markAllRead()),

  onNotification: publicProcedure
    .subscription(({ ctx }) => observable<Notification>((emit) => {
      return ctx.notification.subscribe((n) => emit.next(n));
    })),
});
```

### System Router

```typescript
export const systemRouter = router({
  health: publicProcedure
    .query(({ ctx }) => ({
      mesh: ctx.mesh.getHealth(),
      agent: ctx.agent.getStats(),
      uptime: process.uptime(),
    })),

  settings: publicProcedure
    .query(({ ctx }) => ctx.canvas.getSettings()),

  updateSettings: publicProcedure
    .input(SettingsSchema)
    .mutation(({ ctx, input }) => ctx.canvas.updateSettings(input)),
});
```

## 4. MessagePort Channels

For high-throughput data that bypasses tRPC.

### Terminal Output Channel

```typescript
// Main process: establish MessagePort pair for terminal data
function setupTerminalChannel(win: BrowserWindow) {
  const { port1, port2 } = new MessageChannelMain();

  // port1 -> renderer (via preload)
  win.webContents.postMessage('terminal-port', null, [port1]);

  // port2 -> PTY worker (forward terminal output)
  ptyWorker.postMessage({ type: 'set-renderer-port' }, [port2]);
}

// Renderer: receive and process terminal data
window.electronAPI.onTerminalPort((port: MessagePort) => {
  port.onmessage = (event) => {
    const { sessionId, data } = event.data;
    // Write directly to xterm instance -- no React re-render needed
    terminalPool.getTerminal(sessionId)?.write(data);
  };

  // Send input back
  port.postMessage({ type: 'write', sessionId, data: inputData });
});
```

### Mesh Event Channel

```typescript
// Similar pattern for mesh network events
function setupMeshChannel(win: BrowserWindow) {
  const { port1, port2 } = new MessageChannelMain();
  win.webContents.postMessage('mesh-port', null, [port1]);
  truffleWorker.postMessage({ type: 'set-renderer-port' }, [port2]);
}
```

## 5. State Management Pattern

### Main Process (Zustand, canonical state)

```typescript
// The main process holds the canonical state.
// This is NOT a renderer store -- it runs in Node.js.
import { createStore } from 'zustand/vanilla';

const agentStore = createStore<AgentStoreState>((set, get) => ({
  projects: [],
  sessions: {},
  activeCount: 0,

  // Called by AgentService when spaghetti emits events
  updateSession: (projectSlug, session) => set((state) => ({
    sessions: {
      ...state.sessions,
      [projectSlug]: state.sessions[projectSlug]?.map(s =>
        s.id === session.id ? session : s
      ) ?? [session],
    },
  })),
}));
```

### Renderer (Zustand + tRPC hydration)

```typescript
// Renderer stores are hydrated from tRPC queries and kept
// in sync via tRPC subscriptions. They are NOT the source of truth.

const useAgentStore = create<AgentStoreState>((set) => ({
  projects: [],
  sessions: {},

  // Hydrated from tRPC query on mount
  // Updated via tRPC subscription in real-time
}));

// In a React component:
function useAgentSync() {
  const { data: projects } = trpc.agent.projects.useQuery();
  const store = useAgentStore();

  // Hydrate on query success
  useEffect(() => {
    if (projects) store.setProjects(projects);
  }, [projects]);

  // Subscribe to real-time events
  trpc.agent.onEvent.useSubscription(undefined, {
    onData: (event) => store.handleEvent(event),
  });
}
```

### Multi-Window State Sync

```
Window A mutates state
    |
    v
tRPC mutation -> Main process updates canonical store
    |
    v
Main process emits via tRPC subscription
    |
    +-> Window A receives update (optimistic already applied)
    +-> Window B receives update (applies to its local store)
    +-> Window C receives update
```

---

## Open Questions

- [ ] Should we use `electron-trpc` v0.7 or write a custom tRPC link for more control?
- [ ] How to handle tRPC subscription reconnection when a window is backgrounded/restored?
- [ ] Should canvas state sync use tRPC subscriptions or a dedicated MessagePort?
- [ ] Do we need request batching for initial data hydration (many queries on app start)?
- [ ] How to version the tRPC API for potential future web client compatibility?
