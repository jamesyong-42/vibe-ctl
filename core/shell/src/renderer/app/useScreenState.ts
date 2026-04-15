import { useState } from 'react';

export type ScreenState =
  | { kind: 'loading' }
  | { kind: 'onboarding' }
  | { kind: 'version-gate'; currentVersion: string; requiredVersion: string }
  | { kind: 'main' };

export interface ScreenController {
  state: ScreenState;
  goToMain: () => void;
  goToOnboarding: () => void;
  finishOnboarding: () => void;
  triggerVersionGate: (current: string, required: string) => void;
}

const HAS_ONBOARDED_KEY = 'vibe-ctl.onboarded';

/**
 * Drives the screen state machine. Starts in `loading`; once boot
 * tasks complete, `decideAfterBoot` transitions to `onboarding`
 * (first run) or `main`. `triggerVersionGate` is called imperatively
 * by the runtime if the kernel version check fails mid-session.
 *
 * Local state today — subscribes to IPC signals from the main process
 * once runtime wiring lands.
 */
export function useScreenState(): ScreenController {
  const [state, setState] = useState<ScreenState>({ kind: 'loading' });

  // TODO(runtime-ipc): subscribe to main-process lifecycle events:
  //   - 'boot-complete' → decideAfterBoot(controller)
  //   - 'version-gate'  → controller.triggerVersionGate(...)

  return {
    state,
    goToMain: () => setState({ kind: 'main' }),
    goToOnboarding: () => setState({ kind: 'onboarding' }),
    finishOnboarding: () => {
      if (typeof window !== 'undefined') {
        localStorage.setItem(HAS_ONBOARDED_KEY, 'true');
      }
      setState({ kind: 'main' });
    },
    triggerVersionGate: (currentVersion, requiredVersion) =>
      setState({ kind: 'version-gate', currentVersion, requiredVersion }),
  };
}

/**
 * Called by the LoadingScreen's `onReady`. Decides whether to jump
 * straight to main (returning user) or onboarding (first run).
 */
export function decideAfterBoot(controller: ScreenController): void {
  const onboarded =
    typeof window !== 'undefined' && localStorage.getItem(HAS_ONBOARDED_KEY) === 'true';
  if (onboarded) controller.goToMain();
  else controller.goToOnboarding();
}
