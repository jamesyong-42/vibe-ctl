# 09 -- Mobile Companion

> Expo React Native app, code sharing strategy, communication with desktop.
> This is Layer 6 -- a platform surface for on-the-go agent management.

**Depends on:** `01-foundation.md`, `03-ipc-protocol.md`, `07-mesh-network.md`
**Phase:** 4 (final phase -- desktop is the priority)

---

## 1. Scope

The mobile app is a **lightweight companion**, not a full canvas experience.

**What it does:**
- Agent status dashboard (list view, not canvas)
- Push notifications for approval requests
- Quick approve/deny actions
- Basic session viewer (messages, not terminal)
- Device presence awareness (which machines are online)

**What it does NOT do:**
- Infinite canvas (desktop only)
- Terminal rendering (xterm.js doesn't run in React Native)
- WebGL/R3F visualizations
- General-purpose agent spawning
- Full session management

## 2. Tech Stack

| Layer | Choice | Version | Rationale |
|---|---|---|---|
| Framework | Expo | 55.x | Managed workflow, EAS build, push notifications |
| Navigation | Expo Router | 5.x | File-based routing, deep links |
| State | Zustand | 5.x | Same stores as desktop (shared package) |
| Styling | NativeWind | 4.x | Tailwind CSS for React Native |
| Icons | Lucide React Native | latest | Same icon set as desktop |

## 3. Communication Architecture

### Phase 4a: Direct Mesh (same Tailscale network)

```
Mobile (React Native)
    |
    v
Tailscale VPN (installed on phone)
    |
    v
Truffle mesh (WebSocket connection to desktop)
    |
    v
Desktop vibe-ctl
```

- Mobile runs a lightweight truffle node (if NAPI-RS supports React Native)
- OR: connects directly to desktop's truffle WebSocket endpoint
- Receives SyncedStore updates for agent status, device presence
- Sends approval decisions back via namespace messaging

### Phase 4b: Relay Server (push notifications when offline)

```
Mobile (React Native)
    |
    v
Push Notification (Expo Push / APNs / FCM)
    ^
    |
Relay Server (lightweight, hosted)
    ^
    |
Desktop vibe-ctl (pushes via relay when mobile is offline)
```

The relay server is minimal:
- Receives agent events from desktop via truffle or HTTP
- Forwards as push notifications to registered mobile devices
- Stores pending approvals for mobile to fetch on wake
- No session data stored (privacy: all data is peer-to-peer)

## 4. App Structure

```
apps/mobile/
|-- package.json
|-- app.json                      # Expo config
|-- eas.json                      # EAS Build config
|-- app/
|   |-- _layout.tsx               # Root layout (auth guard, providers)
|   |-- (tabs)/
|   |   |-- _layout.tsx           # Tab navigator
|   |   |-- index.tsx             # Dashboard tab (overview)
|   |   |-- agents.tsx            # Agents list tab
|   |   |-- devices.tsx           # Devices tab
|   |   +-- settings.tsx          # Settings tab
|   |-- agent/
|   |   +-- [id].tsx              # Agent detail screen
|   |-- approve/
|   |   +-- [id].tsx              # Approval detail (deep link target)
|   +-- connect.tsx               # Tailscale connection setup
|-- components/
|   |-- AgentListItem.tsx
|   |-- ApprovalCard.tsx
|   |-- DeviceCard.tsx
|   |-- StatusBadge.tsx           # Shared with @vibe-ctl/ui (adapted)
|   +-- ConnectionStatus.tsx
+-- hooks/
    |-- use-mesh.ts               # Mesh connection hook
    |-- use-agents.ts             # Agent data from mesh
    +-- use-notifications.ts      # Push notification handling
```

## 5. Screen Designs

### Dashboard Tab (Home)

```
+----------------------------------+
| vibe-ctl                    [cog]|
+----------------------------------+
|                                  |
| [!] 2 Pending Approvals         |
| +------------------------------+|
| | Bash: rm -rf /tmp/build      ||
| | project-a  ·  MacBook Pro    ||
| | [Allow]            [Deny]    ||
| +------------------------------+|
| +------------------------------+|
| | Edit: src/main.ts            ||
| | project-b  ·  PC             ||
| | [Allow]            [Deny]    ||
| +------------------------------+|
|                                  |
| Active Agents (7)                |
| +-----+  +-----+  +-----+      |
| |  3  |  |  2  |  |  2  |      |
| |proj |  |proj |  |gen  |      |
| |  a  |  |  b  |  |     |      |
| +-----+  +-----+  +-----+      |
|                                  |
| Devices (2 online)               |
| o MacBook Pro    12ms            |
| o PC (Windows)   45ms            |
| - iPad (offline)                 |
+----------------------------------+
| [Home] [Agents] [Devices] [Set] |
+----------------------------------+
```

### Agent Detail Screen

```
+----------------------------------+
| < Agent #a1b2c3                  |
+----------------------------------+
| Project: vibe-ctl                |
| Branch: feature/canvas           |
| Status: active (processing)      |
| Device: MacBook Pro              |
| Started: 2h ago                  |
| Messages: 142                    |
| Tokens: 45.2K in / 12.8K out    |
+----------------------------------+
| Recent Activity                  |
| 14:32  Edited src/App.tsx        |
| 14:31  Ran: pnpm build          |
| 14:30  Read: src/main.ts        |
| 14:28  User: "Fix the build..." |
| ...                              |
+----------------------------------+
| [Resume on Desktop]  [Chat]      |
+----------------------------------+
```

## 6. Code Sharing Strategy

### Shared Packages

```
packages/shared/    --> Types, constants (works everywhere)
packages/store/     --> Zustand stores (Zustand supports RN)
```

### What Can NOT Be Shared

- `@vibe-ctl/widgets` (depends on DOM, WebGL, xterm.js)
- `@vibe-ctl/ui` (DOM React components -- need RN equivalents)
- `@jamesyong42/infinite-canvas` (DOM + WebGL)
- `xterm-r3f`, `r3f-msdf` (WebGL)

### Adaptation Pattern

```typescript
// packages/store/src/agent-store.ts
// This store works in both desktop (Node/React) and mobile (RN)
import { create } from 'zustand';
import type { AgentSession, Project } from '@vibe-ctl/shared';

export const useAgentStore = create<AgentStoreState>((set) => ({
  projects: [],
  sessions: {},

  setProjects: (projects) => set({ projects }),
  updateSession: (slug, session) => set((state) => ({
    sessions: {
      ...state.sessions,
      [slug]: state.sessions[slug]?.map(s =>
        s.id === session.id ? session : s
      ) ?? [session],
    },
  })),
}));

// Desktop: hydrated via tRPC
// Mobile: hydrated via mesh SyncedStore or REST API
```

## 7. Push Notifications

### Expo Push Setup

```typescript
// hooks/use-notifications.ts
import * as Notifications from 'expo-notifications';
import { registerForPushNotificationsAsync } from '../utils/notifications';

export function useNotificationSetup() {
  useEffect(() => {
    // Register for push and get token
    registerForPushNotificationsAsync().then(token => {
      if (token) {
        // Send token to relay server or desktop via mesh
        meshService.send(desktopDeviceId, 'mobile-register', {
          pushToken: token,
          platform: Platform.OS,
        });
      }
    });

    // Handle received notifications
    const subscription = Notifications.addNotificationReceivedListener(
      (notification) => {
        const data = notification.request.content.data;
        if (data.type === 'approval-request') {
          // Show in-app approval UI
          agentStore.addPendingApproval(data);
        }
      }
    );

    return () => subscription.remove();
  }, []);
}
```

### Deep Links for Approvals

```
// URL scheme: vibe-ctl://approve/{requestId}
// Opens directly to approval screen
```

---

## Open Questions

- [ ] Can truffle's NAPI-RS bindings compile for React Native (iOS/Android)?
  If not, need a WebSocket-based alternative for mesh connection.
- [ ] Relay server: self-hosted or use a service like Expo Push?
- [ ] How to pair mobile with desktop? QR code? Tailscale device list?
- [ ] Should mobile be able to view terminal output (read-only text, not xterm)?
- [ ] React Native `expo-notifications` category actions for approve/deny?
- [ ] How to handle mesh authentication on mobile (Tailscale app required)?
- [ ] Should mobile have offline support (cached last-known agent state)?
- [ ] iPad support: should it show a simplified canvas view?
