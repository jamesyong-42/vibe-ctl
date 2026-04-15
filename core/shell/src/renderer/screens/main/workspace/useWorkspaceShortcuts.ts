import { useEffect } from 'react';
import { useEngine } from './useEngine.js';

/**
 * Global keyboard shortcuts for the canvas workspace: undo/redo,
 * exit-container, delete-selection. Input focus is respected —
 * Backspace/Delete are ignored while the user is typing in an input.
 *
 * Mounted once by `WorkspaceLayer`.
 */
export function useWorkspaceShortcuts(): void {
  const engine = useEngine();

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const mod = e.metaKey || e.ctrlKey;

      if (mod && !e.shiftKey && e.key === 'z') {
        e.preventDefault();
        engine.undo();
        engine.markDirty();
        return;
      }

      if (mod && e.shiftKey && e.key === 'z') {
        e.preventDefault();
        engine.redo();
        engine.markDirty();
        return;
      }

      if (e.key === 'Escape' && engine.getNavigationDepth() > 0) {
        engine.exitContainer();
        engine.markDirty();
        return;
      }

      if (e.key === 'Backspace' || e.key === 'Delete') {
        const el = document.activeElement;
        if (el?.closest('input, textarea, select, [contenteditable]')) return;
        const selected = engine.getSelectedEntities();
        for (const id of selected) engine.destroyEntity(id);
        if (selected.length > 0) engine.markDirty();
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [engine]);
}
