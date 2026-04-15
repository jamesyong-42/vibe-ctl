/**
 * Inspector feature — mirrors the Settings composition pattern.
 * Encapsulates its button + panel + open-state hook so HUD mounts it
 * as a single element.
 */

import type { FC } from 'react';
import { InspectorButton } from './InspectorButton.js';
import { InspectorPanel } from './InspectorPanel.js';
import { useInspectorPanel } from './useInspectorPanel.js';

export const Inspector: FC = () => {
  const { isOpen, toggle, close } = useInspectorPanel();
  return (
    <>
      <InspectorButton active={isOpen} onClick={toggle} />
      {isOpen && <InspectorPanel onClose={close} />}
    </>
  );
};
