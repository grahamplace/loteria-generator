/**
 * Estimated progress for a card while its illustration is generated.
 *
 * The job reports no real progress, so this is time-based. Calibrated on prod
 * cards (Nov 2026): median ~60s, p75 ~130s, p90 ~260s. The curve eases toward
 * MAX_PROGRESS and never reaches 100% on its own; the card simply swaps to the
 * finished art when the job completes.
 */
const TIME_CONSTANT_MS = 75_000;
const MIN_PROGRESS = 0.03;
const MAX_PROGRESS = 0.95;

export function estimateProgress(elapsedMs: number): number {
  const t = Math.max(0, elapsedMs);
  const eased = MAX_PROGRESS * (1 - Math.exp(-t / TIME_CONSTANT_MS));
  return Math.max(MIN_PROGRESS, eased);
}

export type ProcessingStage = 'reading' | 'sketching' | 'painting' | 'finishing' | 'slow';

const STAGES: Array<[startMs: number, stage: ProcessingStage]> = [
  [240_000, 'slow'],
  [120_000, 'finishing'],
  [45_000, 'painting'],
  [15_000, 'sketching'],
  [0, 'reading'],
];

export function processingStage(elapsedMs: number): ProcessingStage {
  for (const [start, stage] of STAGES) if (elapsedMs >= start) return stage;
  return 'reading';
}
