# @vibe-ctl/plugin-notifications

Unified notifications plugin for vibe-ctl. Hosts the approval-flow state
machine (routing Claude Code and other agent prompts to the user),
emits OS-level notifications through the kernel's host bridge, and
surfaces in-app toast/banner widgets. Provides the `notifications`
service so other plugins can queue prompts.
