import { useContext } from 'react';
import { DockContext, type DockState } from './DockProvider.js';

export function useDock(): DockState {
  const ctx = useContext(DockContext);
  if (!ctx) throw new Error('useDock() called outside <DockProvider/>.');
  return ctx;
}
