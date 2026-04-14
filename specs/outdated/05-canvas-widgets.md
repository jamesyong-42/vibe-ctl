# 05 -- Canvas & Widget System

> Infinite canvas integration, widget framework, ECS systems, LOD, layout.
> This is Layer 5 -- the primary user interface.

**Depends on:** `01-foundation.md`, `03-ipc-protocol.md`, `04-agent-management.md`, `06-terminal.md`
**Blocks:** Nothing (top of the stack for desktop)

---

## 1. Canvas Integration

### Engine Setup

```typescript
// src/renderer/canvas/CanvasView.tsx
import { createLayoutEngine, InfiniteCanvas } from '@jamesyong42/infinite-canvas';
import { widgetDefs } from './widget-defs';

const engine = createLayoutEngine({
  zoom: { min: 0.05, max: 8 },
  breakpoints: {
    micro:    { maxWidth: 60 },
    compact:  { maxWidth: 200 },
    normal:   { maxWidth: 600 },
    expanded: { maxWidth: 1200 },
    detailed: { maxWidth: Infinity },
  },
});

function CanvasView() {
  return (
    <InfiniteCanvas
      engine={engine}
      widgets={widgetDefs}
      grid={{
        spacing: [20, 100, 500],
        colors: ['#ffffff08', '#ffffff12', '#ffffff18'],
      }}
      selection={{ handleColor: '#3b82f6' }}
    />
  );
}
```

### Widget Registration

```typescript
// src/renderer/canvas/widget-defs.ts
import type { WidgetDef } from '@jamesyong42/infinite-canvas';
import { AgentCard } from '@vibe-ctl/widgets/agent-card';
import { TerminalWidget } from '@vibe-ctl/widgets/terminal';
import { ProjectBoard } from '@vibe-ctl/widgets/project-board';
import { NotificationStream } from '@vibe-ctl/widgets/notification-stream';
import { AgentChat } from '@vibe-ctl/widgets/agent-chat';
import { DeviceStatus } from '@vibe-ctl/widgets/device-status';

export const widgetDefs: WidgetDef[] = [
  {
    type: 'agent-card',
    component: AgentCard,
    surface: 'dom',
    defaultSize: { width: 320, height: 200 },
  },
  {
    type: 'terminal',
    component: TerminalWidget,
    surface: 'dom',
    defaultSize: { width: 640, height: 400 },
  },
  {
    type: 'project-board',
    component: ProjectBoard,
    surface: 'dom',
    defaultSize: { width: 480, height: 360 },
  },
  {
    type: 'notification-stream',
    component: NotificationStream,
    surface: 'dom',
    defaultSize: { width: 360, height: 500 },
  },
  {
    type: 'agent-chat',
    component: AgentChat,
    surface: 'dom',
    defaultSize: { width: 480, height: 600 },
  },
  {
    type: 'device-status',
    component: DeviceStatus,
    surface: 'dom',
    defaultSize: { width: 280, height: 180 },
  },
];
```

## 2. Widget Breakpoint Rendering

Each widget renders differently at each breakpoint (zoom level).
The infinite canvas's ECS breakpoint system handles the switching.

### Agent Card

| Breakpoint | Rendering |
|---|---|
| **micro** | Colored status dot (green=active, yellow=waiting, gray=idle) |
| **compact** | Name + status badge in single row |
| **normal** | Full card: project name, session summary, state, last activity, tool info |
| **expanded** | Normal + recent messages preview, token usage, git branch |
| **detailed** | Expanded + full message log, subagent tree |

```typescript
function AgentCard({ entityId, width, height }: WidgetProps) {
  const breakpoint = useBreakpoint(entityId);
  const data = useWidgetData<AgentCardData>(entityId);
  const session = useAgentSession(data.sessionId);

  switch (breakpoint) {
    case 'micro':
      return <AgentDot status={session.state} />;
    case 'compact':
      return <AgentCardCompact session={session} />;
    case 'normal':
      return <AgentCardNormal session={session} width={width} height={height} />;
    case 'expanded':
    case 'detailed':
      return <AgentCardExpanded session={session} width={width} height={height} />;
  }
}
```

### Terminal Widget

| Breakpoint | Rendering |
|---|---|
| **micro** | Colored rectangle (terminal icon) |
| **compact** | Last output line as static text |
| **normal** | Full xterm-r3f terminal (instance from pool) |
| **expanded** | Terminal + session info header |

```typescript
function TerminalWidget({ entityId, width, height }: WidgetProps) {
  const breakpoint = useBreakpoint(entityId);
  const data = useWidgetData<TerminalWidgetData>(entityId);

  if (breakpoint === 'micro') {
    return <TerminalIcon status={data.status} />;
  }
  if (breakpoint === 'compact') {
    return <TerminalLastLine line={data.lastLine} />;
  }

  // normal+ : attach real terminal from pool
  return (
    <TerminalView
      sessionId={data.sessionId}
      width={width}
      height={height}
      showHeader={breakpoint === 'expanded' || breakpoint === 'detailed'}
    />
  );
}
```

## 3. Custom ECS Systems

The infinite canvas's ECS architecture lets us add systems that run every
frame (or on change) to keep widget data in sync with application state.

### Agent Status Sync System

Updates agent-card widget data when agent events arrive:

```typescript
function createAgentSyncSystem(engine: LayoutEngine) {
  // Subscribe to agent events from tRPC
  trpc.agent.onEvent.subscribe(undefined, {
    onData: (event) => {
      // Find all agent-card widgets for this session
      const widgets = engine.query(Widget)
        .filter(e => {
          const w = engine.getComponent(e, Widget);
          const d = engine.getComponent(e, WidgetData);
          return w?.type === 'agent-card' && d?.sessionId === event.sessionId;
        });

      for (const entity of widgets) {
        engine.updateWidgetData(entity, {
          state: event.newState,
          lastActivity: event.timestamp,
          currentTool: event.tool ?? null,
        });
      }
    },
  });
}
```

### Terminal LOD System

Manages terminal instance pool based on visibility and zoom:

```typescript
import { TerminalPool } from './terminal-pool';

const pool = new TerminalPool({ maxInstances: 10 });

function createTerminalLODSystem(engine: LayoutEngine) {
  // Run when visibility or breakpoint changes
  engine.onFrameChanges((changes) => {
    if (!changes.breakpointsChanged.length && !changes.entered.length && !changes.exited.length) {
      return;
    }

    const terminals = engine.query(Widget)
      .filter(e => engine.getComponent(e, Widget)?.type === 'terminal');

    for (const entity of terminals) {
      const visible = engine.hasTag(entity, Visible);
      const bp = engine.getComponent(entity, WidgetBreakpoint)?.value;
      const data = engine.getComponent(entity, WidgetData);

      if (visible && (bp === 'normal' || bp === 'expanded' || bp === 'detailed')) {
        // Should have a live terminal
        pool.attach(data.sessionId, entity);
      } else {
        // Release terminal instance back to pool
        pool.detach(data.sessionId);
      }
    }
  });
}
```

### Auto-Layout System

Arranges widgets by project grouping when triggered:

```typescript
function autoLayoutByProject(engine: LayoutEngine, projects: Project[]) {
  const PADDING = 40;
  const COLUMN_WIDTH = 400;
  let x = 0;

  for (const project of projects) {
    // Create or find project container
    let container = findContainer(engine, project.slug);
    if (!container) {
      container = engine.addWidget({
        type: 'project-board',
        position: { x, y: 0 },
        size: { width: COLUMN_WIDTH, height: 200 },
        data: { projectSlug: project.slug },
      });
      engine.addTag(container, Container);
    }

    // Layout agent cards within container
    let y = 240;
    for (const session of project.sessions) {
      engine.addWidget({
        type: 'agent-card',
        position: { x: x + 20, y },
        size: { width: 320, height: 200 },
        data: { sessionId: session.id },
        parent: container,
      });
      y += 220;
    }

    x += COLUMN_WIDTH + PADDING;
  }
}
```

## 4. Canvas Layout & Navigation

### Hierarchical Navigation

The canvas uses containers to group widgets by project:

```
Top-Level Canvas (zoomed out: overview of all projects)
|
+-- [Project A] container
|   |-- Agent Card 1
|   |-- Agent Card 2
|   |-- Terminal 1
|   +-- Notification Stream
|
+-- [Project B] container
|   |-- Agent Card 3
|   +-- Terminal 2
|
+-- [General Agents] container
|   |-- Code Reviewer
|   +-- Research Assistant
|
+-- [Devices] container
    |-- MacBook Pro (this device)
    +-- PC (remote)
```

**Navigation flow:**
- Zoomed out: see all project containers as compact cards
- Zoom into a container: see individual widgets
- Double-click container: "enter" it (push nav stack, isolated view)
- Breadcrumb or back button: "exit" container (pop nav stack)

### Canvas State Persistence

```typescript
interface CanvasState {
  version: 2;
  viewport: { x: number; y: number; zoom: number };
  widgets: Array<{
    id: string;
    type: string;
    position: { x: number; y: number };
    size: { width: number; height: number };
    zIndex: number;
    parentId?: string;
    data: Record<string, unknown>;
    locked?: boolean;
    minimized?: boolean;
  }>;
  containers: Array<{
    id: string;
    label: string;
    color?: string;
    collapsed?: boolean;
  }>;
}

// Autosave: debounced 500ms after any change
// File: ~/.vibe-ctl/canvas-state.json
// Migrations via version field
```

## 5. Canvas Chrome (Non-Widget UI)

### Toolbar

Fixed position, top of canvas. Contains:
- Navigation breadcrumbs (when inside container)
- Zoom controls (-, +, fit all)
- View mode toggle (canvas / list)
- Search trigger (Cmd+K)
- Settings gear

### Side Panel

Collapsible left panel with:
- Project tree navigator (quick access to any project)
- Active agents list (filterable, sortable)
- Recent activity feed

### Command Palette (Cmd+K)

Quick actions:
- Navigate to project/agent
- Spawn general agent
- Open terminal
- Search sessions
- Toggle widgets
- Canvas actions (fit all, reset layout, auto-layout)

### Minimap

Small overview in corner showing full canvas with viewport indicator.
Uses the infinite canvas's spatial index data for efficient rendering.

## 6. Widget Interaction Patterns

### Drag & Drop

- Drag widgets to reposition (built into infinite-canvas)
- Drag from side panel to canvas to add new widgets
- Drag between containers to move agents between groups

### Context Menu (Right-Click)

Each widget type defines its own context menu:
- Agent Card: Resume, Chat, View Logs, Open Terminal, Remove
- Terminal: Detach (pop-out), Kill, Resize, Remove
- Project Board: Enter, Auto-Layout, Collapse, Remove
- All: Lock Position, Minimize, Duplicate

### Pop-Out

Any widget can be "popped out" into its own Electron window:
1. User right-clicks -> "Detach to Window"
2. Main process creates new BrowserWindow
3. Window renders just that widget at full size
4. Widget on canvas shows "Detached" overlay with "Bring Back" button
5. Closing the window returns widget to canvas

---

## Open Questions

- [ ] Should the canvas persist widget data (agent session IDs) or re-discover on load?
- [ ] How to handle widgets for agents that no longer exist (stale canvas state)?
- [ ] Should auto-layout be automatic on first launch or always manual?
- [ ] How many WebGL contexts can Electron handle? (xterm-r3f uses WebGL per terminal)
- [ ] Should we add connection edges between related widgets (agent -> terminal -> project)?
- [ ] How to handle canvas state conflicts when synced across mesh? (Or keep local-only?)
- [ ] Should the R3F layer of infinite-canvas be used for any widgets, or all DOM?
