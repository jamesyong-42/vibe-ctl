# @vibe-ctl/plugin-dynamic-island

macOS-only dynamic island helper. Spawns the bundled Swift NotchHelper
binary (shipped in `apps/desktop/resources/NotchHelper/`), bridges its
IPC to the plugin event bus, and surfaces agent status and pending
approvals in the dynamic island region. Silently no-ops on other
platforms via the manifest's `engines.platform` gate.
