import { useState } from 'react';

type StepId = 'welcome' | 'mesh' | 'finish';
const STEPS: StepId[] = ['welcome', 'mesh', 'finish'];

/**
 * Tracks the first-run onboarding flow position. Placeholder — once
 * onboarding persists completion to `kernel/user-settings` via IPC,
 * this hook reads the "has-onboarded" flag and short-circuits.
 */
export function useOnboardingProgress() {
  const [index, setIndex] = useState(0);
  const step = STEPS[index] ?? 'finish';
  return {
    step,
    index,
    total: STEPS.length,
    next: () => setIndex((i) => Math.min(i + 1, STEPS.length - 1)),
    back: () => setIndex((i) => Math.max(i - 1, 0)),
    isLast: index === STEPS.length - 1,
  };
}
