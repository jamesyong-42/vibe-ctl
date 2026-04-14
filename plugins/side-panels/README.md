# @vibe-ctl/plugin-side-panels

Left/right side panel host. Owns the chrome, tab strip, and resize
handles for the two side panels. Widgets from any plugin whose
`placements` include `side-panel:left` or `side-panel:right` are
discovered and rendered here. Also contributes a pair of chrome widgets
(`left-panel-host`, `right-panel-host`) that the shell mounts once.
