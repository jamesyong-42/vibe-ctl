/**
 * First-run welcome flow. Steps live under `./steps/`; this screen is
 * just the stepper shell + step router.
 */

import type { FC } from 'react';
import { WelcomeStep } from './steps/WelcomeStep.js';
import { useOnboardingProgress } from './useOnboardingProgress.js';

export interface OnboardingScreenProps {
  onDone: () => void;
}

export const OnboardingScreen: FC<OnboardingScreenProps> = ({ onDone }) => {
  const { step, next, isLast } = useOnboardingProgress();
  const advance = () => (isLast ? onDone() : next());

  return (
    <div className="flex h-screen w-screen items-center justify-center bg-neutral-50 dark:bg-neutral-900">
      {step === 'welcome' && <WelcomeStep onContinue={advance} />}
      {step === 'mesh' && (
        <div className="text-neutral-500 dark:text-neutral-400">Mesh setup step — placeholder.</div>
      )}
      {step === 'finish' && (
        <div className="text-neutral-500 dark:text-neutral-400">Finish step — placeholder.</div>
      )}
    </div>
  );
};
