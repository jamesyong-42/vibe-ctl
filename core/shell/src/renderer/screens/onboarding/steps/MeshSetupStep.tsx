import { type FC, useCallback, useState } from 'react';
import { useEvent } from '../../../host/useEventStream.js';
import { useHostBridge } from '../../../host/useHostInvoke.js';

export interface MeshSetupStepProps {
  onContinue: () => void;
  onSkip: () => void;
}

type Phase = 'waiting' | 'awaiting-auth' | 'authenticating' | 'failed';

/**
 * Mesh-setup onboarding step.
 *
 * Flow:
 *   1. Mount → show "Setting up mesh…" spinner; kernel utility is
 *      asynchronously running NapiNode.start() in the background.
 *   2. If truffle needs interactive auth, the kernel utility emits
 *      `mesh.auth.required` with a Tailscale URL. Render the URL with
 *      a copyable input and an "Open in Browser" button.
 *   3. On `mesh.auth.completed` → auto-advance to the next step.
 *   4. On `mesh.auth.failed` → show error + retry (= re-subscribe) and
 *      a Skip fallback.
 *   5. Skip sets the offlineMode flag and advances regardless.
 */
export const MeshSetupStep: FC<MeshSetupStepProps> = ({ onContinue, onSkip }) => {
  const bridge = useHostBridge();
  const [phase, setPhase] = useState<Phase>('waiting');
  const [url, setUrl] = useState<string>('');
  const [error, setError] = useState<string>('');
  const [opening, setOpening] = useState(false);

  useEvent('mesh.auth.required', (payload) => {
    setUrl(payload.url);
    setError('');
    setPhase('awaiting-auth');
  });

  useEvent('mesh.auth.completed', () => {
    setPhase('authenticating');
    // Advance right away — the spinner below keeps the transition
    // feeling grounded.
    onContinue();
  });

  useEvent('mesh.auth.failed', (payload) => {
    setError(payload.reason);
    setPhase('failed');
  });

  const openInBrowser = useCallback(async () => {
    if (!url) return;
    setOpening(true);
    try {
      await bridge.invoke('system.openExternal', { url });
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setOpening(false);
    }
  }, [bridge, url]);

  const copyUrl = useCallback(async () => {
    if (!url) return;
    try {
      await navigator.clipboard.writeText(url);
    } catch {
      // Clipboard access can be blocked; silently ignore — the URL is
      // visible in the input field and the user can select-copy manually.
    }
  }, [url]);

  const retry = useCallback(() => {
    setError('');
    setPhase('waiting');
  }, []);

  return (
    <div className="flex flex-col items-center gap-6 text-center">
      <div>
        <h1 className="font-semibold text-neutral-900 text-3xl dark:text-neutral-100">
          Connect your devices
        </h1>
        <p className="mt-3 max-w-md text-neutral-600 dark:text-neutral-400">
          vibe-ctl uses Tailscale to securely sync your canvas, settings, and agents across every
          device you own.
        </p>
      </div>

      {phase === 'waiting' && (
        <div className="flex flex-col items-center gap-3">
          <div
            aria-hidden="true"
            className="h-8 w-8 animate-spin rounded-full border-2 border-neutral-300 border-t-neutral-900 dark:border-neutral-700 dark:border-t-neutral-100"
          />
          <p className="text-neutral-500 text-sm dark:text-neutral-400">Setting up mesh…</p>
        </div>
      )}

      {phase === 'awaiting-auth' && (
        <div className="flex w-full max-w-md flex-col items-center gap-4">
          <h2 className="font-medium text-lg text-neutral-800 dark:text-neutral-200">
            Sign in to Tailscale
          </h2>
          <div className="flex w-full items-center gap-2">
            <input
              type="text"
              readOnly
              value={url}
              aria-label="Tailscale sign-in URL"
              className="flex-1 rounded-md border border-neutral-300 bg-white px-3 py-2 font-mono text-neutral-800 text-xs dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-200"
            />
            <button
              type="button"
              onClick={copyUrl}
              className="rounded-md border border-neutral-300 px-3 py-2 text-neutral-700 text-sm hover:bg-neutral-100 dark:border-neutral-700 dark:text-neutral-200 dark:hover:bg-neutral-800"
            >
              Copy
            </button>
          </div>
          <button
            type="button"
            onClick={openInBrowser}
            disabled={opening}
            className="rounded-full bg-neutral-900 px-6 py-2 font-medium text-sm text-white transition-colors hover:bg-neutral-700 disabled:opacity-60 dark:bg-white dark:text-neutral-900 dark:hover:bg-neutral-200"
          >
            {opening ? 'Opening…' : 'Open in Browser'}
          </button>
          <p className="text-neutral-500 text-sm dark:text-neutral-400">Waiting for approval…</p>
          <button
            type="button"
            onClick={onSkip}
            className="text-neutral-500 text-xs underline-offset-4 hover:underline dark:text-neutral-400"
          >
            Skip for now
          </button>
        </div>
      )}

      {phase === 'authenticating' && (
        <div className="flex flex-col items-center gap-3">
          <div
            aria-hidden="true"
            className="h-8 w-8 animate-spin rounded-full border-2 border-neutral-300 border-t-neutral-900 dark:border-neutral-700 dark:border-t-neutral-100"
          />
          <p className="text-neutral-500 text-sm dark:text-neutral-400">
            Connected — finishing up…
          </p>
        </div>
      )}

      {phase === 'failed' && (
        <div className="flex w-full max-w-md flex-col items-center gap-4">
          <h2 className="font-medium text-lg text-red-700 dark:text-red-400">
            Couldn't connect to the mesh
          </h2>
          <p className="text-neutral-600 text-sm dark:text-neutral-400">{error}</p>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={retry}
              className="rounded-full bg-neutral-900 px-6 py-2 font-medium text-sm text-white hover:bg-neutral-700 dark:bg-white dark:text-neutral-900 dark:hover:bg-neutral-200"
            >
              Try again
            </button>
            <button
              type="button"
              onClick={onSkip}
              className="rounded-full px-5 py-2 font-medium text-neutral-600 text-sm hover:bg-neutral-200/60 dark:text-neutral-400 dark:hover:bg-neutral-800"
            >
              Skip for now
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
