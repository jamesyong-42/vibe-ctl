# @vibe-ctl/plugin-mesh-widgets

UI widgets for the kernel-owned mesh. Contributes a device-status list
(online peers, link state), a shared-services list (services currently
provided on other devices), and port-proxy controls (expose a local port
to the mesh via `ctx.mesh.proxyPort`). Does not own the mesh itself —
that lives in the kernel (spec 02 §3).
