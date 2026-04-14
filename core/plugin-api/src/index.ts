/**
 * @vibe-ctl/plugin-api
 *
 * The public plugin contract for vibe-ctl. Authoritative spec lives in
 * `../../docs/specs/01-plugin-system.md`. Everything in this file is part of
 * the stable API; breaking changes require a major version bump.
 */

// Plugin base class
export { Plugin } from './plugin.js';

// Context and kernel surfaces
export type { CanvasAPI, PluginContext, SettingsAPI, StorageAPI } from './context.js';

// Manifest
export {
  DEFAULT_HOST_PROVIDED,
  parseManifest,
  PluginManifestSchema,
} from './manifest-schema.js';
export type { PluginManifest } from './manifest-schema.js';

// Events (extensible via declaration merging)
export type { VibeEvents } from './events.js';

// Widgets
export type {
  R3FComponent,
  WidgetDef,
  WidgetPlacement,
  WidgetProps,
  WidgetRegistry,
} from './widgets.js';

// Commands / keybindings / menus / themes
export type {
  CommandDef,
  CommandRegistry,
  KeybindingRegistry,
  MenuRegistry,
  ThemeRegistry,
} from './commands.js';

// Services
export type { ProvideOpts, ServiceRegistry, VibeServices } from './services/registry.js';
export type { ServiceProxy } from './services/proxy.js';
export {
  IncompatibleServiceVersion,
  ServiceAccessDenied,
  ServiceUnavailable,
  ServiceUnresolved,
} from './services/errors.js';

// Sync
export type { CrdtDoc, SyncAPI, SyncedStore } from './sync.js';

// Mesh
export type {
  MeshAPI,
  MeshMessage,
  MessageHandler,
  Peer,
  PeerEvent,
  ProxyPortOpts,
} from './mesh.js';

// UI
export type {
  BadgeProps,
  ButtonProps,
  IconProps,
  InputProps,
  ListItemProps,
  ListProps,
  ModalProps,
  PanelProps,
  SelectOption,
  SelectProps,
  SpinnerProps,
  TooltipProps,
  UI,
} from './ui.js';

// Permissions
export { PermissionDenied } from './permissions.js';
export type { KernelPermission, PermissionAPI, PermissionString } from './permissions.js';

// Disposable
export type { Disposable } from './disposable.js';

// React hooks
export {
  useAsync,
  useService,
  useUI,
  useWidgetConfig,
  useWidgetPlugin,
} from './hooks.js';
export type { AsyncState } from './hooks.js';

// RPC
export type { PluginRPC, Remote } from './rpc.js';

// Shared primitives
export type { Breakpoint, Logger, PluginTier, Point, Size } from './types.js';
