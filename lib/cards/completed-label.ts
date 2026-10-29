/**
 * Label to show when a generation job completes. A non-empty local label wins:
 * the job read the label from the DB when it started, so a label the user
 * edited while it ran would otherwise be reverted by the stale value. A fresh
 * upload has an empty local label and takes the AI-generated one.
 */
export function completedLabel(localLabel: string, streamLabel: string): string {
  return localLabel || streamLabel;
}
