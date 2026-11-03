/**
 * Estimated progress for a card while its illustration is generated.
 *
 * The job reports no real progress, so this is time-based. Calibrated on prod
 * cards (Nov 2026): generations cluster at 10–50s (peak 20–40s) with a tail to
 * ~100s. A typical card lands around 70%, a slow one around 90%. The curve
 * eases toward MAX_PROGRESS and never reaches 100% on its own; the card swaps
 * to the finished art when the job completes.
 */
const TIME_CONSTANT_MS = 26_000;
const MIN_PROGRESS = 0.03;
const MAX_PROGRESS = 0.95;

export function estimateProgress(elapsedMs: number): number {
  const t = Math.max(0, elapsedMs);
  const eased = MAX_PROGRESS * (1 - Math.exp(-t / TIME_CONSTANT_MS));
  return Math.max(MIN_PROGRESS, eased);
}

export type ProcessingStage = 'reading' | 'sketching' | 'painting' | 'finishing' | 'slow';

const STAGES: Array<[startMs: number, stage: ProcessingStage]> = [
  [90_000, 'slow'],
  [35_000, 'finishing'],
  [15_000, 'painting'],
  [5_000, 'sketching'],
  [0, 'reading'],
];

export function processingStage(elapsedMs: number): ProcessingStage {
  for (const [start, stage] of STAGES) if (elapsedMs >= start) return stage;
  return 'reading';
}
