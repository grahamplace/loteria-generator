import { describe, it, expect } from 'vitest';
import { sheetSplitToast } from '@/lib/cards/sheet-split-toast';

describe('sheetSplitToast', () => {
  it('all duplicates → allAlreadyOnBoard', () => {
    expect(sheetSplitToast({ foundCount: 3, createdCount: 0, skippedCount: 3 })).toBe(
      'allAlreadyOnBoard'
    );
  });

  it('created < found - skipped → boardFull', () => {
    expect(sheetSplitToast({ foundCount: 6, createdCount: 3, skippedCount: 1 })).toBe('boardFull');
  });

  it('all fit → null', () => {
    expect(sheetSplitToast({ foundCount: 6, createdCount: 5, skippedCount: 1 })).toBeNull();
    expect(sheetSplitToast({ foundCount: 3, createdCount: 3, skippedCount: 0 })).toBeNull();
  });
});
