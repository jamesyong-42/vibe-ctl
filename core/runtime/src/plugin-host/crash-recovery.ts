/**
 * CrashRecovery. Spec 05 §10 (split-plugin crash recovery).
 *
 * Reusable backoff-and-retry logic shared by the kernel-utility
 * supervisor (Phase 3) and the split-plugin supervisor (Phase 6).
 *
 * Tracks crash timestamps within a rolling window. After exceeding
 * maxRestarts within windowMs, reports 'failed'. Otherwise reports
 * 'restart' and exposes the next backoff delay from the configured
 * backoffMs schedule.
 */

export interface CrashRecoveryOptions {
  /** Maximum restarts allowed within the rolling window. */
  maxRestarts: number;
  /** Rolling window duration in milliseconds. */
  windowMs: number;
  /** Backoff schedule; index clamped to array length. */
  backoffMs: number[];
}

export class CrashRecovery {
  readonly #opts: CrashRecoveryOptions;
  readonly #timestamps: number[] = [];
  #crashCount = 0;

  constructor(opts: CrashRecoveryOptions) {
    this.#opts = opts;
  }

  /**
   * Record a crash. Prunes timestamps outside the rolling window, then
   * checks if the crash count exceeds `maxRestarts`.
   *
   * @returns `'restart'` if a restart should be attempted, `'failed'`
   *          if the limit has been exceeded.
   */
  recordCrash(): 'restart' | 'failed' {
    const now = Date.now();
    this.#timestamps.push(now);
    this.#crashCount++;

    // Prune timestamps outside the rolling window.
    const cutoff = now - this.#opts.windowMs;
    while (this.#timestamps.length > 0 && this.#timestamps[0]! < cutoff) {
      this.#timestamps.shift();
    }

    if (this.#timestamps.length > this.#opts.maxRestarts) {
      return 'failed';
    }
    return 'restart';
  }

  /**
   * Get the backoff delay for the current crash count. Clamps to the
   * last entry in `backoffMs` if crashCount exceeds the array length.
   */
  getBackoffMs(): number {
    const { backoffMs } = this.#opts;
    if (backoffMs.length === 0) return 0;
    return backoffMs[Math.min(this.#crashCount - 1, backoffMs.length - 1)]!;
  }

  /** Reset all crash state. Call after a successful recovery. */
  reset(): void {
    this.#timestamps.length = 0;
    this.#crashCount = 0;
  }

  /** Current crash count (for diagnostics). */
  get crashCount(): number {
    return this.#crashCount;
  }
}
