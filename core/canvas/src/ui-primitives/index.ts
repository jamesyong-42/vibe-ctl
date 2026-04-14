import type { UI } from '@vibe-ctl/extension-api';
import { Badge } from './Badge.js';
import { Button } from './Button.js';
import { Icon } from './Icon.js';
import { Input } from './Input.js';
import { List } from './List.js';
import { ListItem } from './ListItem.js';
import { Modal } from './Modal.js';
import { Panel } from './Panel.js';
import { Select } from './Select.js';
import { Separator } from './Separator.js';
import { Spinner } from './Spinner.js';
import { Tooltip } from './Tooltip.js';

export {
  Badge,
  Button,
  Icon,
  Input,
  List,
  ListItem,
  Modal,
  Panel,
  Select,
  Separator,
  Spinner,
  Tooltip,
};

// Re-export component prop types (canonically declared in
// @vibe-ctl/extension-api) for convenient import from @vibe-ctl/canvas.
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
} from '@vibe-ctl/extension-api';

/**
 * The runtime implementation of `ctx.ui`. The kernel assigns this to
 * every plugin's `PluginContext` when constructing `ctx`. Plugins read
 * it via `useUI()` inside widget components.
 *
 * Typed against `UI` from `@vibe-ctl/extension-api` so the kernel can
 * pass this straight into the plugin context with no widening.
 */
export const ui: UI = {
  Panel,
  Button,
  Input,
  Select,
  List,
  ListItem,
  Modal,
  Tooltip,
  Icon,
  Badge,
  Spinner,
  Separator,
};
