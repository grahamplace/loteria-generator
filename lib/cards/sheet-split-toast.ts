type SheetSplitCounts = { foundCount: number; createdCount: number; skippedCount: number };

/** Which toast a finished sheet split shows, if any. Same on locked and unlocked boards. */
export function sheetSplitToast(msg: SheetSplitCounts): 'allAlreadyOnBoard' | 'boardFull' | null {
  if (msg.createdCount === 0) return 'allAlreadyOnBoard';
  if (msg.createdCount < msg.foundCount - msg.skippedCount) return 'boardFull';
  return null;
}
