import { describe, it, expect } from 'vitest';
import { getCampaignTemplate, campaignTemplateOptions } from '@/lib/email/campaigns/registry';
import { REENGAGEMENT_DISCOUNT_PERCENT, REENGAGEMENT_EXPIRY_DAYS } from '@/lib/constants';

describe('getCampaignTemplate', () => {
  it('returns the reengagement entry with correct discount values', () => {
    const template = getCampaignTemplate('reengagement');
    expect(template).toBeDefined();
    expect(template!.discount).toBeDefined();
    expect(template!.discount!.percent).toBe(REENGAGEMENT_DISCOUNT_PERCENT);
    expect(template!.discount!.expiryDays).toBe(REENGAGEMENT_EXPIRY_DAYS);
  });

  it('returns undefined for unknown keys', () => {
    expect(getCampaignTemplate('nope')).toBeUndefined();
  });
});

describe('campaignTemplateOptions', () => {
  it('returns serializable options for all templates', () => {
    const options = campaignTemplateOptions();
    expect(options).toEqual([
      { key: 'reengagement', label: 'Re-engagement (25% off)', hasDiscount: true },
    ]);
  });
});
