/**
 * Screen router — the top-level state machine between loading,
 * onboarding, version-gate, main, and debug.
 *
 * Renders exactly one screen at a time. `version-gate` can be
 * triggered imperatively from anywhere (passed up via IPC later);
 * until then, loading -> (onboarding if first run) -> main is the
 * golden path.
 *
 * Debug screen: dev-only, accessible via Cmd+Shift+D.
 */

import { type FC, useEffect } from 'react';
import { BootScreen } from '../screens/boot/BootScreen.js';
import { SyncDebugScreen } from '../screens/debug/SyncDebugScreen.js';
import { LoadingScreen } from '../screens/loading/LoadingScreen.js';
import { MainScreen } from '../screens/main/MainScreen.js';
import { OnboardingScreen } from '../screens/onboarding/OnboardingScreen.js';
import { VersionGateScreen } from '../screens/version-gate/VersionGateScreen.js';
import { decideAfterBoot, useScreenState } from './useScreenState.js';

export const ScreenRouter: FC = () => {
  const controller = useScreenState();
  const { state } = controller;

  // Dev-only: Cmd+Shift+D toggles debug screen.
  useEffect(() => {
    if (!import.meta.env.DEV) return;
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key === 'd') {
        e.preventDefault();
        if (state.kind === 'debug') {
          controller.goToMain();
        } else {
          controller.goToDebug();
        }
      }
      // Escape closes debug screen.
      if (e.key === 'Escape' && state.kind === 'debug') {
        e.preventDefault();
        controller.goToMain();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [state.kind, controller]);

  switch (state.kind) {
    case 'boot':
      return <BootScreen />;
    case 'loading':
      return <LoadingScreen onReady={() => decideAfterBoot(controller)} />;
    case 'onboarding':
      return <OnboardingScreen onDone={controller.finishOnboarding} />;
    case 'version-gate':
      return (
        <VersionGateScreen
          currentVersion={state.currentVersion}
          requiredVersion={state.requiredVersion}
        />
      );
    case 'debug':
      return <SyncDebugScreen onClose={controller.goToMain} />;
    case 'main':
      return <MainScreen />;
  }
};
