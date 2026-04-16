import { useEffect, useState } from 'react';
import { useHostBridgeOptional } from '../host/index.js';

export type ScreenState =
  | { kind: 'boot' }
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
 * Drives the screen state machine (spec 05 §9.2).
 *
 * Starts in `boot` — the HostBridgeProvider always renders children,
 * so the router mounts immediately and shows `<BootScreen />` while the
 * preload handshake is in flight. Once the bridge becomes non-null the
 * state flips to `loading`, which hands off to `onboarding` or `main`
 * via `decideAfterBoot`. `triggerVersionGate` is called imperatively by
 * the runtime if the kernel version check fails mid-session.
 *
 * This makes the state machine the single deterministic source of what
 * screen is on display — the provider manages IPC state only.
 */
export function useScreenState(): ScreenController {
  const bridge = useHostBridgeOptional();
  const [state, setState] = useState<ScreenState>({ kind: 'boot' });

  useEffect(() => {
    if (bridge && state.kind === 'boot') {
      setState({ kind: 'loading' });
    }
  }, [bridge, state.kind]);

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
