import { describe, it, expect } from 'vitest';
import { lifecycleEmailLabel } from '@/lib/email/lifecycle-labels';
import { LIFECYCLE_EMAIL_TYPE_EMPTY_BOARD_NUDGE } from '@/lib/constants';

describe('lifecycleEmailLabel', () => {
  it('labels a known type', () => {
    expect(lifecycleEmailLabel(LIFECYCLE_EMAIL_TYPE_EMPTY_BOARD_NUDGE)).toBe('Empty board nudge');
  });

  it('humanizes an unregistered type instead of showing a raw key', () => {
    expect(lifecycleEmailLabel('win_back_v2')).toBe('Win back v2');
  });
});
