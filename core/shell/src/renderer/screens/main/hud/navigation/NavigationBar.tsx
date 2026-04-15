/**
 * Navigation region in the HUD top-left strip.
 *
 * Sits to the right of the native macOS traffic lights (~70px) as a
 * horizontal group: back button → breadcrumb pill. Same visual idiom
 * as Apple Freeform and the infinite-canvas playground.
 */

import type { FC } from 'react';
import { BackButton } from './BackButton.js';
import { Breadcrumbs } from './Breadcrumbs.js';
import { useNavigationCrumbs } from './useNavigationCrumbs.js';

export const NavigationBar: FC = () => {
  const { crumbs, canGoBack, goBack, jumpToDepth } = useNavigationCrumbs();

  return (
    <div
      style={{
        position: 'absolute',
        top: 16,
        left: 82,
        zIndex: 50,
        display: 'flex',
        alignItems: 'center',
        gap: 8,
      }}
    >
      <BackButton disabled={!canGoBack} onClick={goBack} />
      <Breadcrumbs crumbs={crumbs} onJump={jumpToDepth} />
    </div>
  );
};
