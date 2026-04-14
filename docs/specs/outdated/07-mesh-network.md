# 07 -- Mesh Network

> Truffle integration, cross-device sync, SyncedStore, remote agent control.
> This is a Layer 4 service -- the network that connects all devices.

**Depends on:** `01-foundation.md`, `02-electron-shell.md`, `03-ipc-protocol.md`
**Used by:** `04-agent-management.md` (remote agents), `06-terminal.md` (remote terminals),
  `08-notifications.md` (cross-device approvals)

---

## 1. Architecture

```
Main Process                    Truffle Worker (utilityProcess)
+-------------------+          +---------------------------+
| MeshService       |  MsgPort | NapiNode                  |
|  - peer tracking  | <======> |  - Tailscale discovery     |
|  - store bridge   |          |  - WS messaging            |
|  - namespace      |          |  - SyncedStore instances   |
|    routing        |          |  - File transfer           |
+-------------------+          +---------------------------+
       |                                    |
       |                          Tailscale VPN tunnel
       |                                    |
       |                       Remote vibe-ctl instances
       v
  AgentService (remote agent data)
  TerminalService (remote terminal bridge)
  NotificationService (cross-device approvals)
```

## 2. Truffle Node Configuration

```typescript
// apps/desktop/src/main/workers/truffle-worker.ts
import { NapiNode } from '@vibecook/truffle';

const node = new NapiNode();

await node.start({
  app_id: 'vibe-ctl',                              // Namespace isolation
  device_name: os.hostname(),                        // Human-readable
  sidecar_path: getSidecarPath(),                    // Go binary path
  state_dir: join(app.getPath('userData'), 'truffle'), // Persist keys + device ID
  ws_port: 9417,                                     // WebSocket port
  // auth_key: optional, for headless/CI machines
});
```

### Sidecar Binary Distribution

The Go sidecar (`sidecar-slim`) must be bundled with the Electron app:

```yaml
# electron-builder.yml
extraResources:
  - from: "node_modules/@vibecook/truffle/sidecar/${os}-${arch}/sidecar-slim"
    to: "sidecar-slim"
    filter: ["**/*"]
```

```typescript
function getSidecarPath(): string {
  if (is.dev) {
    return join(__dirname, '../../node_modules/@vibecook/truffle/sidecar/...');
  }
  return join(process.resourcesPath, 'sidecar-slim');
}
```

## 3. MeshService

```typescript
class MeshService {
  private worker: Electron.UtilityProcess;
  private port: MessagePortMain;
  private peers: Map<string, PeerState> = new Map();
  private peerEmitter = new EventEmitter<PeerEvent>();

  async start() {
    // 1. Spawn truffle worker
    this.worker = utilityProcess.fork(
      join(__dirname, 'workers/truffle-worker.js')
    );

    // 2. Establish MessagePort
    const { port1, port2 } = new MessageChannelMain();
    this.port = port1;
    this.worker.postMessage({ type: 'init', port: port2 }, [port2]);

    // 3. Listen for events from worker
    this.port.on('message', (event) => {
      const msg = event.data;
      switch (msg.type) {
        case 'ready':
          this.handleReady(msg);
          break;
        case 'peer-event':
          this.handlePeerEvent(msg.event);
          break;
        case 'mesh-message':
          this.routeMessage(msg.namespace, msg.message);
          break;
        case 'store-update':
          this.handleStoreUpdate(msg.storeId, msg.data);
          break;
      }
    });

    // 4. Wait for truffle to be ready
    await this.waitForReady();
  }

  // --- Peer Management ---

  getPeers(): PeerState[] {
    return Array.from(this.peers.values());
  }

  getLocalInfo(): DeviceInfo {
    return this.localInfo;
  }

  subscribePeerChanges(cb: (event: PeerEvent) => void): () => void {
    return this.peerEmitter.on('change', cb);
  }

  async ping(peerId: string): Promise<PingResult> {
    return this.rpc('ping', { peerId });
  }

  // --- Messaging ---

  async send(peerId: string, namespace: string, data: unknown) {
    this.port.postMessage({ type: 'send', peerId, namespace, data });
  }

  async broadcast(namespace: string, data: unknown) {
    this.port.postMessage({ type: 'broadcast', namespace, data });
  }

  // --- Message Routing ---

  private routeMessage(namespace: string, message: NamespacedMessage) {
    switch (namespace) {
      case 'notify':
        this.notificationService.handleMeshNotification(message);
        break;
      case 'pty':
        this.terminalService.handleMeshTerminalMessage(message);
        break;
      case 'agent-control':
        this.agentService.handleMeshAgentControl(message);
        break;
    }
  }
}
```

## 4. SyncedStore Slices

Each device publishes its state to shared SyncedStores. Other devices
see all slices and merge them into a unified view.

### Device Presence Store

```typescript
interface DevicePresenceSlice {
  deviceId: string;
  deviceName: string;
  platform: NodeJS.Platform;
  online: boolean;
  lastSeen: string;            // ISO-8601
  appVersion: string;
  uptime: number;              // seconds
}

// Published by each device on startup, updated every 30s heartbeat
// Store ID: 'device-presence'
```

### Agent Status Store

```typescript
interface AgentStatusSlice {
  deviceId: string;
  projects: Array<{
    slug: string;
    path: string;
    displayName: string;
    sessionCount: number;
    activeCount: number;
    lastActivity: string;
  }>;
  pendingApprovals: Array<{
    id: string;
    sessionId: string;
    projectSlug: string;
    tool: string;
    command: string;
    timestamp: string;
  }>;
  generalAgents: Array<{
    templateId: string;
    sessionId: string;
    state: AgentState;
  }>;
}

// Published by each device when agent state changes
// Store ID: 'agent-status'
```

### Terminal Session Store

```typescript
interface TerminalSessionSlice {
  deviceId: string;
  sessions: Array<{
    id: string;
    cwd: string;
    state: 'running' | 'exited';
    shared: boolean;           // Available for remote viewing
    cols: number;
    rows: number;
  }>;
}

// Published by each device's avocado PTYSyncStore
// Store ID: 'terminal-sessions'
```

## 5. Cross-Device Agent Control

### Remote Approval Flow

```
Device A: Agent hits permission request
    |
    v
Spaghetti hook event -> AgentService detects approval needed
    |
    +-- Local notification (system + dynamic island)
    +-- MeshService.broadcast('notify', { type: 'approval-request', ... })
    |
    v
Device B: receives 'notify' message
    |
    v
NotificationService shows approval UI (canvas widget / system notification)
    |
    v
User approves on Device B
    |
    v
MeshService.send(deviceA, 'notify', { type: 'approval-response', ... })
    |
    v
Device A: receives response
    |
    v
AgentService.approveRequest() via spaghetti channel
```

### Remote Agent Browse

Any device can browse another device's agent sessions:

```typescript
// Device B wants to see Device A's sessions
// 1. AgentStatusSlice from SyncedStore has project list
// 2. For full session data, send targeted request:
meshService.send(deviceA, 'agent-control', {
  type: 'get-sessions',
  projectSlug: 'my-project',
});

// Device A responds with full session list
// This is peer-to-peer, no central server
```

## 6. Truffle Worker Protocol

Messages between main process and truffle worker:

### Main -> Worker

```typescript
type MainToWorkerMessage =
  | { type: 'init'; config: NapiNodeConfig }
  | { type: 'stop' }
  | { type: 'send'; peerId: string; namespace: string; data: unknown }
  | { type: 'broadcast'; namespace: string; data: unknown }
  | { type: 'ping'; peerId: string; requestId: string }
  | { type: 'store-set'; storeId: string; data: unknown }
  | { type: 'store-get-all'; storeId: string; requestId: string };
```

### Worker -> Main

```typescript
type WorkerToMainMessage =
  | { type: 'ready'; localInfo: DeviceInfo }
  | { type: 'peer-event'; event: PeerEvent }
  | { type: 'mesh-message'; namespace: string; message: NamespacedMessage }
  | { type: 'store-update'; storeId: string; peerId: string; data: unknown }
  | { type: 'ping-result'; requestId: string; result: PingResult }
  | { type: 'error'; error: string };
```

## 7. Authentication Flow

Truffle uses Tailscale for authentication. On first launch:

```
1. Node.start() -> sidecar starts -> Tailscale needs auth
2. Worker sends: { type: 'auth-required', url: 'https://login.tailscale.com/...' }
3. Main process opens URL in system browser (shell.openExternal)
4. User authenticates in browser
5. Tailscale callback completes auth
6. Worker sends: { type: 'ready', localInfo: ... }
```

For headless/CI machines, provide `auth_key` in config.

## 8. Network Health Monitoring

```typescript
interface MeshHealth {
  connected: boolean;
  peerCount: number;
  onlinePeerCount: number;
  authStatus: 'authenticated' | 'needs-auth' | 'expired';
  networkType: 'direct' | 'relay' | 'unknown';
  latencyMs: Map<string, number>;  // peerId -> last ping
}

// Exposed via tRPC system.health query
// Shown in UI: device-status widgets, system tray tooltip
```

---

## Open Questions

- [ ] How to handle Tailscale auth expiration mid-session?
- [ ] Should we support multiple tailnets (e.g., personal + work)?
- [ ] How to handle large SyncedStore updates (100+ agents)?
  Should we diff/batch updates?
- [ ] Truffle sidecar binary size -- how much does it add to the app bundle?
- [ ] Should the mesh worker auto-reconnect on crash, or prompt the user?
- [ ] What happens when two devices try to approve the same request simultaneously?
- [ ] Should canvas state be synced across mesh? (Could enable "pick up where you left off")
- [ ] NAPI binary ABI compatibility: does it need electron-rebuild or are prebuilds sufficient?
