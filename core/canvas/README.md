# @vibe-ctl/canvas

Kernel wrapper around [`@jamesyong42/infinite-canvas`](https://www.npmjs.com/package/@jamesyong42/infinite-canvas).

Responsibilities:

1. **Kernel-aware engine** (`KernelCanvasEngine`) — wraps infinite-canvas
   `LayoutEngine` and adds a reactive widget-type registry that plugins
   feed via `ctx.widgets.register()`.
2. **Canvas-sync adapter** (`CanvasSyncAdapter`) — bridges the
   infinite-canvas ECS world to the kernel-owned `kernel/canvas-layout`
   truffle `CrdtDoc` (Loro map). See
   `../../docs/specs/02-kernel-runtime.md` §4.2.
3. **UI primitives** — runtime implementations of the
   `ctx.ui.*` React components declared in
   `@vibe-ctl/plugin-api`.
4. **Placement slots** — React components that mount plugin-contributed
   widgets in each built-in placement (canvas, side panel, status bar,
   command palette, notification surface).

Internal to vibe-ctl. Not published. Consumed by `@vibe-ctl/runtime`
and the desktop shell.
