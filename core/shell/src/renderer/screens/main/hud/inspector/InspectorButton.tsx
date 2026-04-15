import { FloatingButton, InspectorIcon } from '@vibe-ctl/ui';
import type { FC } from 'react';

export interface InspectorButtonProps {
  active: boolean;
  onClick: () => void;
}

/**
 * Bottom-right HUD FAB for the inspector feature. Stateless — receives
 * active + onClick from the parent feature entry.
 */
export const InspectorButton: FC<InspectorButtonProps> = ({ active, onClick }) => (
  <FloatingButton
    onClick={onClick}
    title="Inspector"
    active={active}
    className="absolute bottom-4 right-4"
  >
    <InspectorIcon />
  </FloatingButton>
);
