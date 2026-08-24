import { describe, it, expect } from 'vitest';
import { lifecycleEmailLabel } from '@/lib/email/lifecycle-labels';
import {
  LIFECYCLE_EMAIL_TYPE_EMPTY_BOARD_NUDGE,
  LIFECYCLE_EMAIL_TYPE_NO_BOARD,
  NO_BOARD_DISCOUNT_PERCENT,
} from '@/lib/constants';

describe('lifecycleEmailLabel', () => {
  it('labels a known type', () => {
    expect(lifecycleEmailLabel(LIFECYCLE_EMAIL_TYPE_EMPTY_BOARD_NUDGE)).toBe('Board but no cards');
  });

  it('labels the no-board campaign so the admin table never shows its raw key', () => {
    expect(lifecycleEmailLabel(LIFECYCLE_EMAIL_TYPE_NO_BOARD)).toBe(
      `No board yet (${NO_BOARD_DISCOUNT_PERCENT}% off)`
    );
  });

  it('humanizes an unregistered type instead of showing a raw key', () => {
    expect(lifecycleEmailLabel('win_back_v2')).toBe('Win back v2');
  });
});
