/**
 * Screen router — the top-level state machine between loading,
 * onboarding, version-gate, and main.
 *
 * Renders exactly one screen at a time. `version-gate` can be
 * triggered imperatively from anywhere (passed up via IPC later);
 * until then, loading → (onboarding if first run) → main is the
 * golden path.
 */

import type { FC } from 'react';
import { LoadingScreen } from '../screens/loading/LoadingScreen.js';
import { MainScreen } from '../screens/main/MainScreen.js';
import { OnboardingScreen } from '../screens/onboarding/OnboardingScreen.js';
import { VersionGateScreen } from '../screens/version-gate/VersionGateScreen.js';
import { decideAfterBoot, useScreenState } from './useScreenState.js';

export const ScreenRouter: FC = () => {
  const controller = useScreenState();
  const { state } = controller;

  switch (state.kind) {
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
    case 'main':
      return <MainScreen />;
  }
};
