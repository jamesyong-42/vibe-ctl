# @vibe-ctl/plugin-project-manager

Project tree and grouping for vibe-ctl. Consumes the `claude-code`
service (optional) to discover sessions, groups them by on-disk project
directory, and exposes a typed `projects` service other plugins
(side-panels, quick-actions) can depend on. Registers a project-tree
widget for placement in a side panel.
