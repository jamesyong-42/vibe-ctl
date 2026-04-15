import { useContext } from 'react';
import { ThemeContext } from './ThemeProvider.js';

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) {
    throw new Error('useTheme() called outside <ThemeProvider/>.');
  }
  return ctx;
}
