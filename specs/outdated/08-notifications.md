# 08 -- Notifications & Approvals

> Approval flow, dynamic island, system tray, system notifications.
> This is a Layer 4 service -- the attention layer across all surfaces.

**Depends on:** `02-electron-shell.md`, `03-ipc-protocol.md`,
  `04-agent-management.md`, `07-mesh-network.md`
**Used by:** `05-canvas-widgets.md` (notification-stream widget)

---

## 1. Notification Types

```typescript
type NotificationType =
  | 'approval-request'       // Agent needs tool permission
  | 'approval-response'      // Approval was granted/denied (from another device)
  | 'session-started'        // New agent session began
  | 'session-ended'          // Agent session completed
  | 'session-error'          // Agent session errored
  | 'tool-completed'         // Long-running tool finished
  | 'device-joined'          // New device appeared on mesh
  | 'device-left';           // Device went offline

interface Notification {
  id: string;
  type: NotificationType;
  title: string;
  body: string;
  timestamp: string;              // ISO-8601
  read: boolean;
  sourceDevice: string;           // deviceId where event originated
  sessionId?: string;             // Associated agent session
  projectSlug?: string;
  data?: Record<string, unknown>; // Type-specific payload
}

interface ApprovalRequest {
  id: string;                     // Unique request ID
  sessionId: string;
  projectSlug: string;
  deviceId: string;               // Where the agent runs
  tool: string;                   // e.g., 'Bash', 'Edit', 'Write'
  command: string;                // The command/action being requested
  timestamp: string;
  status: 'pending' | 'approved' | 'denied' | 'expired';
}
```

## 2. Notification Service

```typescript
class NotificationService {
  private notifications: Notification[] = [];
  private pendingApprovals: Map<string, ApprovalRequest> = new Map();
  private emitter = new EventEmitter<Notification>();

  // --- Notification Sources ---

  // From local spaghetti hook events
  handleAgentEvent(event: AgentEvent) {
    switch (event.type) {
      case 'approval-needed':
        this.createApprovalNotification(event);
        break;
      case 'session-started':
      case 'session-ended':
      case 'tool-completed':
        this.createInfoNotification(event);
        break;
    }
  }

  // From mesh network (remote device events)
  handleMeshNotification(message: NamespacedMessage) {
    const data = message.payload;
    switch (data.type) {
      case 'approval-request':
        this.createApprovalNotification({
          ...data,
          sourceDevice: message.from,
          isRemote: true,
        });
        break;
      case 'approval-response':
        this.handleRemoteApprovalResponse(data);
        break;
    }
  }

  // --- Notification Creation ---

  private createApprovalNotification(event: ApprovalEvent) {
    const request: ApprovalRequest = {
      id: event.requestId ?? crypto.randomUUID(),
      sessionId: event.sessionId,
      projectSlug: event.projectSlug,
      deviceId: event.deviceId ?? localDeviceId,
      tool: event.tool,
      command: event.command,
      timestamp: new Date().toISOString(),
      status: 'pending',
    };
    this.pendingApprovals.set(request.id, request);

    const notification: Notification = {
      id: crypto.randomUUID(),
      type: 'approval-request',
      title: `${event.tool} needs approval`,
      body: event.command,
      timestamp: request.timestamp,
      read: false,
      sourceDevice: request.deviceId,
      sessionId: event.sessionId,
      projectSlug: event.projectSlug,
      data: { requestId: request.id },
    };

    this.addNotification(notification);
    this.dispatchToAllSurfaces(notification, request);
  }

  // --- Dispatch to All Surfaces ---

  private dispatchToAllSurfaces(notification: Notification, request?: ApprovalRequest) {
    // 1. tRPC subscription (canvas widget, renderer UI)
    this.emitter.emit(notification);

    // 2. System notification (OS-level)
    if (notification.type === 'approval-request' && request) {
      this.showSystemNotification(notification, request);
    }

    // 3. Dynamic island (macOS)
    this.notchService?.showNotification(notification, request);

    // 4. System tray badge
    this.updateTrayBadge();

    // 5. Mesh broadcast (other devices)
    if (!notification.data?.isRemote) {
      this.meshService?.broadcast('notify', {
        type: notification.type,
        ...notification,
      });
    }
  }
}
```

## 3. System Notifications (OS-level)

```typescript
private showSystemNotification(notification: Notification, request: ApprovalRequest) {
  const n = new Notification({
    title: notification.title,
    body: `${request.projectSlug}: ${notification.body}`,
    urgency: 'critical',        // High priority for approvals
    actions: [
      { type: 'button', text: 'Allow' },
      { type: 'button', text: 'Deny' },
    ],
  });

  n.on('action', (_, index) => {
    if (index === 0) {
      this.handleApproval(request.id, 'approve');
    } else {
      this.handleApproval(request.id, 'deny');
    }
  });

  n.on('click', () => {
    // Focus the app and highlight the relevant agent on canvas
    this.windowManager.showMainWindow();
    this.canvasService.focusWidget(`agent-${request.sessionId}`);
  });

  n.show();
}
```

## 4. Dynamic Island Integration (macOS)

### NotchService

```typescript
class NotchService {
  private helper: ChildProcess | null = null;
  private ready = false;

  async start() {
    if (process.platform !== 'darwin') return;

    const helperPath = getNotchHelperPath();
    if (!helperPath) return;  // No notch helper built

    this.helper = spawn(helperPath, [], {
      stdio: ['pipe', 'pipe', 'pipe'],
    });

    // Parse JSON events from stdout
    const rl = createInterface({ input: this.helper.stdout });
    rl.on('line', (line) => {
      try {
        const event = JSON.parse(line);
        this.handleHelperEvent(event);
      } catch {}
    });

    // Wait for ready signal
    await new Promise<void>((resolve) => {
      this.once('ready', resolve);
    });
  }

  // --- Send Commands to NotchHelper ---

  showNotification(notification: Notification, request?: ApprovalRequest) {
    if (!this.helper || !this.ready) return;

    if (notification.type === 'approval-request' && request) {
      // Show approval pane with Allow/Deny buttons
      this.send({ type: 'setState', state: 'waitingForApproval' });
      this.send({
        type: 'showPane',
        pane: 'approval',
        data: {
          tool: request.tool,
          command: request.command,
          project: request.projectSlug,
        },
      });
    } else {
      // Show brief status update
      this.send({ type: 'setState', state: 'processing' });
      this.send({
        type: 'showPane',
        pane: 'hover',
        data: {
          title: notification.title,
          body: notification.body,
        },
      });
    }
  }

  updateAgentStatus(sessions: AgentSession[]) {
    const instances = sessions.map(s => ({
      id: s.id,
      name: s.projectSlug,
      state: mapToNotchState(s.state),
    }));
    this.send({ type: 'setInstances', instances });
  }

  // --- Receive Events from NotchHelper ---

  private handleHelperEvent(event: NotchEvent) {
    switch (event.type) {
      case 'ready':
        this.ready = true;
        this.emit('ready');
        break;

      case 'approval':
        // User tapped Allow/Deny in the dynamic island
        this.notificationService.handleApproval(
          event.requestId,
          event.decision,  // 'approve' | 'deny'
        );
        break;

      case 'state':
        // NotchHelper state changed (for logging/debugging)
        break;
    }
  }

  private send(msg: object) {
    if (this.helper?.stdin?.writable) {
      this.helper.stdin.write(JSON.stringify(msg) + '\n');
    }
  }

  stop() {
    this.helper?.kill();
    this.helper = null;
  }
}
```

### NotchHelper Binary Location

```typescript
function getNotchHelperPath(): string | null {
  if (is.dev) {
    const devPath = join(__dirname, '../../../notch/.build/release/NotchHelper');
    return existsSync(devPath) ? devPath : null;
  }
  const prodPath = join(process.resourcesPath, 'NotchHelper');
  return existsSync(prodPath) ? prodPath : null;
}
```

## 5. System Tray Badge

```typescript
// Update tray badge with pending approval count
function updateTrayBadge(tray: Tray, pendingCount: number) {
  if (process.platform === 'darwin') {
    app.dock.setBadge(pendingCount > 0 ? `${pendingCount}` : '');
  }
  tray.setTitle(pendingCount > 0 ? `${pendingCount}` : '');
}
```

## 6. Approval Flow State Machine

```
                +---> expired (timeout, default 5 min)
                |
pending ---+---> approved ----> completed
                |
                +---> denied -----> completed
```

```typescript
class ApprovalManager {
  private timeouts = new Map<string, NodeJS.Timeout>();
  private APPROVAL_TIMEOUT = 5 * 60 * 1000;  // 5 minutes

  addRequest(request: ApprovalRequest) {
    this.pendingApprovals.set(request.id, request);

    // Auto-expire after timeout
    const timeout = setTimeout(() => {
      this.handleExpired(request.id);
    }, this.APPROVAL_TIMEOUT);
    this.timeouts.set(request.id, timeout);
  }

  async handleApproval(requestId: string, decision: 'approve' | 'deny') {
    const request = this.pendingApprovals.get(requestId);
    if (!request || request.status !== 'pending') return;

    // Clear timeout
    clearTimeout(this.timeouts.get(requestId));
    this.timeouts.delete(requestId);

    // Update status
    request.status = decision === 'approve' ? 'approved' : 'denied';

    if (request.deviceId === localDeviceId) {
      // Local session: approve via spaghetti channel
      await this.agentService.approveRequest({
        sessionId: request.sessionId,
        requestId: request.id,
      });
    } else {
      // Remote session: send approval via mesh
      await this.meshService.send(request.deviceId, 'notify', {
        type: 'approval-response',
        requestId: request.id,
        decision,
      });
    }

    // Update all surfaces
    this.notificationService.updateApprovalStatus(requestId, request.status);
  }
}
```

## 7. Notification Preferences

```typescript
interface NotificationPreferences {
  // Per-type toggles
  approvalRequests: { system: boolean; notch: boolean; sound: boolean };
  sessionEvents: { system: boolean; notch: boolean; sound: boolean };
  deviceEvents: { system: boolean; notch: boolean; sound: boolean };

  // Global
  doNotDisturb: boolean;
  doNotDisturbSchedule?: { start: string; end: string };  // "22:00" - "08:00"

  // Approval
  approvalTimeout: number;       // seconds, default 300
  autoApprovePatterns?: string[]; // Tool patterns to auto-approve (dangerous!)

  // Sound
  soundEnabled: boolean;
  approvalSound: string;         // 'glass', 'submarine', 'default'
}
```

---

## Open Questions

- [ ] Should we support auto-approval for certain tools/projects? (Security implications)
- [ ] How to handle notification flood (many agents requesting approval simultaneously)?
- [ ] Should expired approvals be auto-denied or left in limbo?
- [ ] How to test the dynamic island integration in CI? (Needs macOS with notch)
- [ ] Should the notification stream widget show all devices' notifications or just local?
- [ ] How to handle duplicate notifications from mesh (same event seen from multiple peers)?
- [ ] Push notification relay server for mobile -- architecture? (Phase 4+)
- [ ] Should we integrate with OS Focus/Do Not Disturb modes?
