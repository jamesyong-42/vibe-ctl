/**
 * Invisible 52px drag strip at the top of the window. Uses Electron's
 * `-webkit-app-region: drag` so the user can grab anywhere in the
 * strip to move the window. HUD FABs inside opt out via `.no-drag`.
 *
 * Lives in `chrome/` because `-webkit-app-region` is Electron-only —
 * the web shell will either omit this or replace it with a DOM-based
 * window move handler, so it doesn't belong in `@vibe-ctl/ui`.
 */

import type { FC } from 'react';

export const DragRegion: FC = () => (
  <div aria-hidden className="app-drag absolute top-0 right-0 left-0 z-40 h-[52px]" />
);
