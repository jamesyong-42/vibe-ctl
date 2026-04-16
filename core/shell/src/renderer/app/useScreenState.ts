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
 * Starts in `boot`. Flips to `loading` when `HostBridgeProvider` reports
 * the handshake has completed (i.e. the bridge is non-null). `loading`
 * then hands off to `onboarding` or `main` via `decideAfterBoot`.
 * `triggerVersionGate` is called imperatively by the runtime if the
 * kernel version check fails mid-session.
 *
 * Note: in the current `AppProviders` layout this hook runs inside the
 * HostBridgeProvider, so `useHostBridgeOptional()` returns non-null on
 * first render of the router — which means the effective initial state
 * is `loading`. The `boot` branch is kept in the state machine for
 * symmetry with spec 05 §9.2 and so future layouts that render the
 * router above the bridge still have a legal state to sit in.
 */
export function useScreenState(): ScreenController {
  const bridge = useHostBridgeOptional();
  const [state, setState] = useState<ScreenState>(() =>
    bridge ? { kind: 'loading' } : { kind: 'boot' },
  );

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
