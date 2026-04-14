# @vibe-ctl/plugin-claude-code

Claude Code session management for vibe-ctl. Discovers Claude Code
sessions through the Spaghetti SDK, exposes a typed `claude-code` service
to the rest of the app, publishes a per-device session index over the
sync fabric, and relays hook events (tool use, approvals) into the event
bus. Pairs with the `notifications` plugin to surface approval requests.
