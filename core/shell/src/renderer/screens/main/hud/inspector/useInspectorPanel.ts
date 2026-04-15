import { useState } from 'react';

export function useInspectorPanel() {
  const [isOpen, setIsOpen] = useState(false);
  return {
    isOpen,
    toggle: () => setIsOpen((v) => !v),
    open: () => setIsOpen(true),
    close: () => setIsOpen(false),
  };
}
