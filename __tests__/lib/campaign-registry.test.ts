import { describe, it, expect } from 'vitest';
import { getCampaignTemplate, campaignTemplateOptions } from '@/lib/email/campaigns/registry';
import {
  REENGAGEMENT_DISCOUNT_PERCENT,
  REENGAGEMENT_EXPIRY_DAYS,
  NO_BOARD_COUPON_ID,
  NO_BOARD_DISCOUNT_PERCENT,
  NO_BOARD_EXPIRY_DAYS,
  LIFECYCLE_EMAIL_TYPE_NO_BOARD,
  LIFECYCLE_EMAIL_TYPE_EMPTY_BOARD_NUDGE,
  SUPPORT_REPLY_TO_EMAIL,
} from '@/lib/constants';

describe('getCampaignTemplate', () => {
  it('returns the reengagement entry with correct discount values', () => {
    const template = getCampaignTemplate('reengagement');
    expect(template).toBeDefined();
    expect(template!.discount).toBeDefined();
    expect(template!.discount!.percent).toBe(REENGAGEMENT_DISCOUNT_PERCENT);
    expect(template!.discount!.expiryDays).toBe(REENGAGEMENT_EXPIRY_DAYS);
  });

  it('returns the no-board entry with correct discount values', () => {
    const template = getCampaignTemplate(LIFECYCLE_EMAIL_TYPE_NO_BOARD);
    expect(template).toBeDefined();
    expect(template!.discount).toBeDefined();
    expect(template!.discount!.percent).toBe(NO_BOARD_DISCOUNT_PERCENT);
    expect(template!.discount!.expiryDays).toBe(NO_BOARD_EXPIRY_DAYS);
  });

  it('gives the no-board campaign its own coupon so redemptions stay attributable', () => {
    const noBoard = getCampaignTemplate(LIFECYCLE_EMAIL_TYPE_NO_BOARD)!;
    const reengagement = getCampaignTemplate('reengagement')!;
    expect(noBoard.discount!.couponId).toBe(NO_BOARD_COUPON_ID);
    expect(noBoard.discount!.couponId).not.toBe(reengagement.discount!.couponId);
  });

  it('routes no-board replies to a human — its copy invites one', () => {
    expect(getCampaignTemplate(LIFECYCLE_EMAIL_TYPE_NO_BOARD)!.replyTo).toBe(
      SUPPORT_REPLY_TO_EMAIL
    );
  });

  it('exposes the empty-board nudge for manual sends, with no discount', () => {
    const template = getCampaignTemplate(LIFECYCLE_EMAIL_TYPE_EMPTY_BOARD_NUDGE);
    expect(template).toBeDefined();
    // The ask is "come try it", not "come buy it" — a discount here would also
    // mint a Stripe promo code per recipient for nothing.
    expect(template!.discount).toBeUndefined();
    expect(template!.replyTo).toBe(SUPPORT_REPLY_TO_EMAIL);
  });

  it('keys the empty-board campaign to the same type its cron writes, so the two dedupe', () => {
    // `lifecycle_emails` is unique on (user_id, type); sharing the key is what
    // makes a manual send to someone the cron already mailed a no-op.
    expect(getCampaignTemplate(LIFECYCLE_EMAIL_TYPE_EMPTY_BOARD_NUDGE)!.key).toBe(
      'empty_board_nudge'
    );
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
      {
        key: LIFECYCLE_EMAIL_TYPE_NO_BOARD,
        label: `No board yet (${NO_BOARD_DISCOUNT_PERCENT}% off)`,
        hasDiscount: true,
      },
      {
        key: LIFECYCLE_EMAIL_TYPE_EMPTY_BOARD_NUDGE,
        label: 'Board but no cards',
        hasDiscount: false,
      },
    ]);
  });

  it('carries no functions across the server/client boundary', () => {
    for (const opt of campaignTemplateOptions()) {
      for (const value of Object.values(opt)) {
        expect(typeof value).not.toBe('function');
      }
    }
  });
});
