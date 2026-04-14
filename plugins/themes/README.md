# @vibe-ctl/plugin-themes

Theme system for vibe-ctl. Provides the `themes` service so other
plugins can contribute new themes (`themes.register({ id, tokens })`),
persists the user's selection through `ctx.settings`, and renders a
theme-picker widget that can be placed on a side panel.
