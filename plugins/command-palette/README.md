# @vibe-ctl/plugin-command-palette

Cmd+K command palette for vibe-ctl. Registers a global keybinding,
mounts a palette widget on the dedicated `command-palette` placement
slot, and aggregates commands contributed by any plugin via
`ctx.commands`. Supports widget-based palette rows so plugins can render
rich result items.
