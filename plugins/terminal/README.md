# @vibe-ctl/plugin-terminal

Terminal plugin for vibe-ctl. Wraps the Avocado SDK to spawn and manage
PTY sessions, publishes per-device session metadata through
`ctx.sync.syncedStore`, and uses `ctx.mesh` to stream PTY bytes to other
devices watching a remote session. Provides the `terminal` service and a
canvas-placeable terminal widget.
