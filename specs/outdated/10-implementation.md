# 10 -- Implementation Plan

> Phased delivery, milestones, dependencies, and risk assessment.
> The roadmap for going from spec to shipping product.

**Depends on:** All other specs
**Audience:** James (planning), Claude (execution context)

---

## 1. Phase Overview

```
Phase 1: Foundation          [Weeks 1-3]    Monorepo + Electron + Spaghetti + Basic Canvas
Phase 2: Terminal & Live     [Weeks 4-6]    Avocado + xterm-r3f + Chat + Approvals
Phase 3: Mesh & Cross-Device [Weeks 7-9]    Truffle + Remote Control + Dynamic Island
Phase 4: Polish & Mobile     [Weeks 10-12]  Expo + General Agents + Distribution
```

Each phase produces a working, testable artifact. No phase depends on
a future phase. You can ship after any phase and have a useful product.

---

## 2. Phase 1: Foundation

**Goal:** Electron app with infinite canvas showing real agent data.

### Milestones

| # | Milestone | Spec | Deliverable |
|---|---|---|---|
| 1.1 | Monorepo scaffold | 01 | pnpm + turbo + electron-vite compiles and runs |
| 1.2 | Shared packages | 01 | @vibe-ctl/shared types, @vibe-ctl/store stubs |
| 1.3 | Electron shell | 02 | Main window opens, titlebar styled, tray icon |
| 1.4 | tRPC bridge | 03 | electron-trpc connects renderer to main |
| 1.5 | Spaghetti integration | 04 | AgentService wraps spaghetti-core, data flows to renderer |
| 1.6 | Infinite canvas | 05 | Canvas renders with grid, pan/zoom works |
| 1.7 | Agent card widget | 05 | Cards on canvas populated from real session data |
| 1.8 | Canvas persistence | 05 | Layout saved/restored on app restart |
| 1.9 | Project containers | 05 | Agents grouped by project, hierarchical navigation |

### Implementation Order

```
1.1 Scaffold ──> 1.2 Packages ──> 1.3 Shell ──> 1.4 tRPC
                                                    |
                                                    v
                  1.5 Spaghetti ──> 1.7 Agent Cards
                                        |
                  1.6 Canvas ───────────+──> 1.8 Persistence
                                        |
                                        +──> 1.9 Containers
```

### Key Decisions for Phase 1

- [ ] Confirm spaghetti-core API compatibility (sync vs async)
- [ ] Verify electron-rebuild with better-sqlite3
- [ ] Test infinite-canvas in Electron renderer (any Chromium quirks?)
- [ ] Choose between Biome and ESLint for linting

### Definition of Done

- App launches, shows infinite canvas with real project/session data
- Pan, zoom, select, drag widgets
- Zoom in: full agent card with status. Zoom out: dots
- Canvas layout survives app restart
- System tray shows agent count

---

## 3. Phase 2: Terminal & Live Interaction

**Goal:** Live terminals on canvas, chat with agents, approve tool requests.

### Milestones

| # | Milestone | Spec | Deliverable |
|---|---|---|---|
| 2.1 | PTY worker | 06 | utilityProcess spawns local PTY sessions |
| 2.2 | MessagePort channel | 03, 06 | Terminal data flows main <-> renderer at full speed |
| 2.3 | Terminal widget | 05, 06 | xterm-r3f renders terminal on canvas |
| 2.4 | Terminal pooling | 06 | Max 10 instances, LRU eviction, LOD switching |
| 2.5 | Spaghetti channel | 04 | Live chat with running Claude Code sessions |
| 2.6 | Agent chat widget | 05 | Chat UI on canvas for live sessions |
| 2.7 | Notification service | 08 | System notifications for agent events |
| 2.8 | Approval flow | 08 | Approve/deny tool requests from canvas + system notification |
| 2.9 | Command palette | 05 | Cmd+K for quick actions |

### Implementation Order

```
2.1 PTY Worker ──> 2.2 MessagePort ──> 2.3 Terminal Widget
                                            |
                                            +──> 2.4 Pooling
                                            
2.5 Spaghetti Channel ──> 2.6 Chat Widget

2.7 Notification Service ──> 2.8 Approval Flow

2.9 Command Palette (independent)
```

### Key Decisions for Phase 2

- [ ] xterm-r3f on DOM surface or WebGL surface in canvas?
- [ ] Terminal resize strategy (debounce? resize-on-drop?)
- [ ] Approval timeout value (5 min default?)
- [ ] Chat widget: inline on canvas or side panel?

### Definition of Done

- Open new terminal on canvas, type commands, see output
- Zoom out: terminal shows last line. Zoom in: full terminal
- Chat with a running Claude Code session
- Agent requests tool permission -> notification appears -> approve from canvas
- Cmd+K opens command palette

---

## 4. Phase 3: Mesh & Cross-Device

**Goal:** See and control agents on other machines. Dynamic island.

### Milestones

| # | Milestone | Spec | Deliverable |
|---|---|---|---|
| 3.1 | Truffle worker | 07 | utilityProcess runs NapiNode, mesh connects |
| 3.2 | Device discovery | 07 | Peers appear as devices in UI |
| 3.3 | SyncedStore bridge | 07 | Agent status syncs across devices |
| 3.4 | Remote agent cards | 04, 07 | Canvas shows agents from all devices |
| 3.5 | Cross-device approval | 07, 08 | Approve remote agent requests |
| 3.6 | Terminal mesh sync | 06, 07 | View remote terminal sessions |
| 3.7 | Device status widget | 05, 07 | Device cards on canvas |
| 3.8 | Dynamic island | 08 | NotchHelper shows status + approvals (macOS) |

### Implementation Order

```
3.1 Truffle Worker ──> 3.2 Discovery ──> 3.3 SyncedStore
                                              |
                                    +---------+---------+
                                    |         |         |
                                    v         v         v
                              3.4 Remote  3.5 Approval  3.6 Terminal
                              Agent Cards  Cross-Device  Mesh Sync
                                    |
                                    v
                              3.7 Device Widget

3.8 Dynamic Island (independent, macOS only)
```

### Key Decisions for Phase 3

- [ ] Truffle NAPI + Electron ABI compatibility (test ASAP)
- [ ] SyncedStore update frequency (every change? batch every 5s?)
- [ ] Canvas state: local-only or synced across mesh?
- [ ] Dynamic island: ship NotchHelper as separate build or embedded?

### Definition of Done

- Two machines running vibe-ctl see each other's agents
- Approve a tool request on Machine B that's running on Machine A
- View a terminal running on Machine A from Machine B
- Dynamic island shows agent count, expands for approvals (macOS)
- Device status widget shows all mesh peers with latency

---

## 5. Phase 4: Polish & Mobile

**Goal:** Ship-ready desktop + mobile companion.

### Milestones

| # | Milestone | Spec | Deliverable |
|---|---|---|---|
| 4.1 | Expo scaffold | 09 | Mobile app compiles and runs |
| 4.2 | Mobile dashboard | 09 | Agent list, device list, status view |
| 4.3 | Mobile notifications | 09 | Push notifications for approvals |
| 4.4 | Mobile approve/deny | 09 | Approve from phone |
| 4.5 | General agent templates | 04 | Spawn pre-configured agents |
| 4.6 | Agent spawning UI | 04, 05 | Spawn agents from canvas command palette |
| 4.7 | Side panel polish | 05 | Project navigator, agent list, search |
| 4.8 | Auto-update | 02 | electron-updater for desktop |
| 4.9 | Code signing | 01 | Notarized macOS DMG, signed Windows NSIS |
| 4.10 | Distribution | 01 | GitHub Releases + auto-update feed |

### Definition of Done

- Desktop app: polished, signed, auto-updating, distributable
- Mobile app: iOS + Android, push notifications, approve from phone
- General agents: spawn a "Code Reviewer" pointed at a project
- Side panel: navigate projects, search sessions, quick access

---

## 6. Risk Assessment

| Risk | Phase | Likelihood | Impact | Mitigation |
|---|---|---|---|---|
| Truffle NAPI binary incompatible with Electron | 3 | Medium | **Critical** | Test in Phase 1. If fails, explore alternative: spawn truffle CLI as child_process |
| better-sqlite3 fails electron-rebuild | 1 | Low | High | Well-tested combo. Fallback: use spaghetti in a utilityProcess |
| xterm-r3f performance in canvas (many terminals) | 2 | Low | Medium | Pool limits (10), LOD system, test early |
| tRPC subscription reconnection issues | 2 | Medium | Medium | Add reconnection logic in renderer, test window minimize/restore |
| Spaghetti API blocking main process | 1 | Medium | Medium | Profile first. Move to utilityProcess if needed |
| Dynamic island crash takes down app | 3 | Low | Low | child_process isolation, auto-restart |
| React/Three.js version conflicts across modules | 1 | Medium | High | pnpm overrides, test all modules together in Phase 1 |
| Mobile: truffle doesn't run on React Native | 4 | High | Medium | Plan B: REST/WebSocket bridge on desktop, mobile connects via HTTP |
| Canvas state too large for JSON persistence | 2 | Low | Low | Migration to SQLite if needed |
| Tailscale auth expires mid-session | 3 | Medium | Low | Re-auth flow, system notification |

### Critical Path

```
Phase 1 critical: Spaghetti integration + Canvas rendering in Electron
Phase 2 critical: MessagePort terminal data flow performance
Phase 3 critical: Truffle NAPI + Electron compatibility
Phase 4 critical: Mobile mesh communication strategy
```

---

## 7. Testing Strategy

### Phase 1
- Manual: launch app, verify real session data appears
- Unit: @vibe-ctl/shared types, @vibe-ctl/store reducers
- Integration: tRPC router tests with mock services

### Phase 2
- Manual: create terminal, type commands, verify output
- Performance: measure terminal data throughput via MessagePort
- Integration: approval flow end-to-end (hook event -> notification -> approve)

### Phase 3
- Manual: two machines, verify cross-device data flow
- Network: test with high latency (Tailscale relay vs direct)
- Stress: 10+ agents across 3 devices

### Phase 4
- Mobile: Expo Go for rapid testing on physical device
- E2E: desktop + mobile approval flow
- Distribution: test auto-update flow on macOS + Windows

---

## 8. Success Metrics

After Phase 1:
- [ ] App launches in under 3 seconds
- [ ] Canvas renders 50+ agent cards at 60fps
- [ ] Real session data visible within 2 seconds of launch

After Phase 2:
- [ ] Terminal input latency < 50ms
- [ ] Approval notification appears within 1 second of hook event
- [ ] 10 concurrent terminals at 60fps

After Phase 3:
- [ ] Cross-device agent data visible within 5 seconds of mesh connect
- [ ] Cross-device approval round-trip < 2 seconds
- [ ] Dynamic island approval shows within 1 second

After Phase 4:
- [ ] Mobile push notification within 5 seconds of approval request
- [ ] App bundle size < 150MB (macOS DMG)
- [ ] Auto-update works on macOS and Windows
