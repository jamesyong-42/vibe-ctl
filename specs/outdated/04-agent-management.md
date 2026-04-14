# 04 -- Agent Management

> Spaghetti integration, agent model, categories, lifecycle, spawning.
> This is a Layer 4 service -- the brain that knows about all agents.

**Depends on:** `01-foundation.md`, `02-electron-shell.md`, `03-ipc-protocol.md`
**Blocks:** `05-canvas-widgets.md` (agent-card widget), `08-notifications.md` (approval flow)

---

## 1. Agent Model

### Agent Categories

**Project-Specific Agents**
- Regular Claude Code sessions tied to a project directory
- Discovered automatically via spaghetti's `~/.claude/projects/` scan
- Grouped by project on the canvas
- Can be resumed from vibe-ctl (opens terminal at project dir)

**General-Purpose Agents**
- Spawned by vibe-ctl in a dedicated workspace
- Pre-configured with CLAUDE.md, memory, and initial prompt
- Categorized by specialty (reviewer, researcher, documenter, etc.)
- Can be "pointed at" any project temporarily

### Agent States

```typescript
type AgentState =
  | 'active'              // Currently running, processing messages
  | 'idle'                // Session exists but Claude is not actively responding
  | 'waiting-approval'    // Blocked on permission request
  | 'waiting-input'       // Waiting for user input
  | 'completed'           // Session ended normally
  | 'error'               // Session crashed or errored
  | 'unknown';            // State cannot be determined

// Derived from spaghetti hook events:
// - SessionStart -> active
// - UserPromptSubmit -> active
// - PreToolUse + PermissionRequest -> waiting-approval
// - Stop -> idle or completed (depends on context)
// - SessionEnd -> completed
```

### Core Types

```typescript
interface AgentSession {
  id: string;                      // Spaghetti session ID
  projectSlug: string;             // Project identifier
  projectPath: string;             // Absolute path to project
  state: AgentState;
  category: 'project' | 'general';

  // Metadata
  firstPrompt: string | null;
  summary: string | null;
  messageCount: number;
  created: string;                 // ISO-8601
  lastActivity: string;            // ISO-8601
  gitBranch: string | null;

  // Live state (from hook events)
  currentTool: string | null;      // e.g., 'Bash', 'Edit', 'Write'
  pendingApproval: ApprovalRequest | null;
  tokenUsage: { input: number; output: number } | null;

  // Context
  deviceId: string;                // Which device this runs on
  deviceName: string;
  isLocal: boolean;                // Running on this machine?
}

interface Project {
  slug: string;
  path: string;
  displayName: string;
  sessions: AgentSession[];
  activeCount: number;
  lastActivity: string;
  memory: string | null;           // MEMORY.md content
}
```

## 2. AgentService Implementation

```typescript
class AgentService {
  private api: SpaghettiAPI;
  private hookWatcher: HookEventWatcher;
  private channelManager: ChannelManager;
  private eventEmitter: EventEmitter<AgentEvent>;

  async start() {
    // 1. Initialize spaghetti core
    this.api = createSpaghettiAPI();
    await this.api.initialize();

    // 2. Start hook event watcher (real-time monitoring)
    this.hookWatcher = createHookEventWatcher();
    await this.hookWatcher.start();
    this.hookWatcher.onEvent((event) => this.handleHookEvent(event));

    // 3. Start channel manager (live session communication)
    this.channelManager = createChannelManager();
    await this.channelManager.start();
    this.channelManager.onSessionsChanged(() => this.refreshLiveSessions());

    // 4. Initial data load
    await this.refreshAll();
  }

  // --- Queries ---

  getProjects(): Project[] {
    return this.api.getProjectList().map(this.enrichProject);
  }

  getSessions(projectSlug: string): AgentSession[] {
    return this.api.getSessionList(projectSlug).map(this.enrichSession);
  }

  getSessionMessages(opts: MessageQuery): MessagePage {
    return this.api.getSessionMessages(
      opts.projectSlug, opts.sessionId, opts.limit, opts.offset
    );
  }

  search(query: string, limit: number): SearchResult[] {
    return this.api.search({ text: query, limit });
  }

  // --- Mutations ---

  async approveRequest(opts: { sessionId: string; requestId: string }) {
    const client = this.channelManager.getClient(opts.sessionId);
    if (!client) throw new Error('Session not connected');
    client.sendPermissionVerdict(opts.requestId, 'allow');
    this.emit({ type: 'approval-sent', ...opts });
  }

  async denyRequest(opts: { sessionId: string; requestId: string; reason?: string }) {
    const client = this.channelManager.getClient(opts.sessionId);
    if (!client) throw new Error('Session not connected');
    client.sendPermissionVerdict(opts.requestId, 'deny');
    this.emit({ type: 'denial-sent', ...opts });
  }

  // --- Event Handling ---

  private handleHookEvent(event: HookEvent) {
    switch (event.event) {
      case 'PreToolUse':
        if (event.payload.permissionRequest) {
          this.emit({
            type: 'approval-needed',
            sessionId: event.sessionId,
            tool: event.payload.tool,
            command: event.payload.input,
          });
        }
        break;

      case 'SessionStart':
        this.emit({ type: 'session-started', sessionId: event.sessionId });
        break;

      case 'Stop':
      case 'SessionEnd':
        this.emit({ type: 'session-ended', sessionId: event.sessionId });
        break;

      case 'PostToolUse':
        this.emit({
          type: 'tool-completed',
          sessionId: event.sessionId,
          tool: event.payload.tool,
        });
        break;
    }
  }
}
```

## 3. General-Purpose Agent Spawning

### Templates

```typescript
interface AgentTemplate {
  id: string;
  name: string;
  description: string;
  icon: string;                    // Lucide icon name
  claudeMd: string;               // CLAUDE.md content
  memory?: Record<string, string>; // filename -> content for memory dir
  defaultPrompt?: string;         // Initial prompt
}

const BUILT_IN_TEMPLATES: AgentTemplate[] = [
  {
    id: 'code-reviewer',
    name: 'Code Reviewer',
    description: 'Reviews code for quality, bugs, and best practices',
    icon: 'search-code',
    claudeMd: `# Code Review Agent
You are a senior code reviewer. When given code or a PR, you:
- Check for bugs, logic errors, security issues
- Evaluate code quality and maintainability
- Suggest concrete improvements with examples
- Be constructive, not nitpicky`,
  },
  {
    id: 'researcher',
    name: 'Research Assistant',
    description: 'Researches topics and synthesizes findings',
    icon: 'book-open',
    claudeMd: `# Research Agent
You research topics thoroughly and provide structured summaries.
Use web search when needed. Cite sources. Be comprehensive but concise.`,
  },
  {
    id: 'documenter',
    name: 'Documentation Writer',
    description: 'Writes and improves documentation',
    icon: 'file-text',
    claudeMd: `# Documentation Agent
You write clear, well-structured documentation. You read existing code
and explain it for other developers. Focus on the "why" not just the "what".`,
  },
];
```

### Spawning Flow

```typescript
async function spawnGeneralAgent(
  template: AgentTemplate,
  targetProject?: string,
): Promise<{ sessionId: string; pid: number }> {
  // 1. Create workspace directory
  const workspace = join(app.getPath('userData'), 'agents', template.id);
  await fs.mkdir(workspace, { recursive: true });

  // 2. Write CLAUDE.md
  let claudeMd = template.claudeMd;
  if (targetProject) {
    claudeMd += `\n\n## Current Target\nYou are currently examining: ${targetProject}\n`;
  }
  await fs.writeFile(join(workspace, 'CLAUDE.md'), claudeMd);

  // 3. Write memory files
  if (template.memory) {
    const memDir = join(workspace, '.claude', 'memory');
    await fs.mkdir(memDir, { recursive: true });
    for (const [name, content] of Object.entries(template.memory)) {
      await fs.writeFile(join(memDir, name), content);
    }
  }

  // 4. Spawn Claude Code session
  // This creates a new terminal via avocado and runs `claude` in it
  const session = await terminalService.createSession({
    cwd: targetProject ?? workspace,
    command: 'claude',
    args: template.defaultPrompt ? ['--prompt', template.defaultPrompt] : [],
  });

  return { sessionId: session.id, pid: session.pid };
}
```

## 4. Cross-Device Agent Discovery

When mesh network is active, agents from remote devices are discovered:

```typescript
// Agent data shared via truffle SyncedStore
interface AgentPresenceSlice {
  deviceId: string;
  deviceName: string;
  projects: Array<{
    slug: string;
    path: string;
    activeSessionCount: number;
    lastActivity: string;
  }>;
  pendingApprovals: Array<{
    sessionId: string;
    tool: string;
    timestamp: string;
  }>;
}

// MeshService publishes local agent state to SyncedStore
// Other devices see it via store subscription
```

## 5. Session Resume

```typescript
async function resumeSession(session: AgentSession) {
  if (!session.isLocal) {
    // Remote session: open chat via spaghetti channel over mesh
    await meshService.send(session.deviceId, 'agent-control', {
      type: 'resume',
      sessionId: session.id,
    });
    return;
  }

  // Local session: open terminal at project dir
  const terminal = await terminalService.createSession({
    cwd: session.projectPath,
    command: 'claude',
    args: ['--resume', session.id],
  });

  // Focus the terminal widget on canvas
  canvasService.focusWidget(`terminal-${terminal.id}`);
}
```

---

## Open Questions

- [ ] How to detect agent state reliably from hook events? (race conditions between events)
- [ ] Can Claude Code be resumed programmatically via `claude --resume {id}`? Need to verify CLI flags.
- [ ] How to handle stale sessions (crashed without SessionEnd event)?
- [ ] Should general-purpose agents have persistent memory across sessions?
- [ ] How to handle agent templates that users define (custom templates)?
- [ ] Should we show subagent activity (agents spawned by agents)?
- [ ] What spaghetti API calls are async vs sync? Need to verify for tRPC integration.
