// lib/email/campaigns/registry.ts
import * as React from 'react';
import { ReengagementEmail, reengagementSubject } from '@/emails/reengagement';
import { NoBoardNudgeEmail, noBoardNudgeSubject } from '@/emails/no-board-nudge';
import { EmptyBoardNudgeEmail, emptyBoardNudgeSubject } from '@/emails/empty-board-nudge';
import { getOrCreateReengagementCoupon, getOrCreateNoBoardCoupon } from '@/lib/stripe-promotions';
import {
  REENGAGEMENT_COUPON_ID,
  REENGAGEMENT_DISCOUNT_PERCENT,
  REENGAGEMENT_EXPIRY_DAYS,
  LIFECYCLE_EMAIL_TYPE_REENGAGEMENT,
  NO_BOARD_COUPON_ID,
  NO_BOARD_DISCOUNT_PERCENT,
  NO_BOARD_EXPIRY_DAYS,
  LIFECYCLE_EMAIL_TYPE_NO_BOARD,
  LIFECYCLE_EMAIL_TYPE_EMPTY_BOARD_NUDGE,
  SUPPORT_REPLY_TO_EMAIL,
} from '@/lib/constants';

export type CampaignEmailProps = {
  name: string;
  locale: 'en' | 'es';
  appUrl: string;
  unsubscribeUrl: string;
  discountCode?: string;
  redeemUrl?: string;
  /** Deep link to the recipient's most recent board; `/start` when they have none. */
  boardUrl: string;
};

export type CampaignDiscount = {
  couponId: string;
  percent: number;
  expiryDays: number;
  ensureCoupon: () => Promise<string>;
};

export type CampaignTemplate = {
  key: string;
  label: string;
  description?: string;
  subject: (locale: 'en' | 'es') => string;
  render: (p: CampaignEmailProps) => React.ReactElement;
  discount?: CampaignDiscount;
  /**
   * Where replies land. Set it on any template whose copy invites a reply —
   * otherwise replies follow `EMAIL_FROM`, a no-reply sender nobody reads.
   */
  replyTo?: string;
};

export type CampaignTemplateOption = {
  key: string;
  label: string;
  hasDiscount: boolean;
};

export const CAMPAIGN_TEMPLATES: CampaignTemplate[] = [
  {
    key: LIFECYCLE_EMAIL_TYPE_REENGAGEMENT,
    label: 'Re-engagement (25% off)',
    subject: reengagementSubject,
    render: (p: CampaignEmailProps): React.ReactElement =>
      ReengagementEmail({
        name: p.name,
        locale: p.locale,
        discountCode: p.discountCode ?? '',
        redeemUrl: p.redeemUrl ?? '',
        unsubscribeUrl: p.unsubscribeUrl,
        appUrl: p.appUrl,
      }) as React.ReactElement,
    discount: {
      couponId: REENGAGEMENT_COUPON_ID,
      percent: REENGAGEMENT_DISCOUNT_PERCENT,
      expiryDays: REENGAGEMENT_EXPIRY_DAYS,
      ensureCoupon: getOrCreateReengagementCoupon,
    },
  },
  {
    key: LIFECYCLE_EMAIL_TYPE_NO_BOARD,
    label: `No board yet (${NO_BOARD_DISCOUNT_PERCENT}% off)`,
    description: 'Signed up but never created a board — they predate the auto-created first board.',
    subject: noBoardNudgeSubject,
    render: (p: CampaignEmailProps): React.ReactElement =>
      NoBoardNudgeEmail({
        name: p.name,
        locale: p.locale,
        discountCode: p.discountCode ?? '',
        redeemUrl: p.redeemUrl ?? '',
        unsubscribeUrl: p.unsubscribeUrl,
        appUrl: p.appUrl,
      }) as React.ReactElement,
    discount: {
      couponId: NO_BOARD_COUPON_ID,
      percent: NO_BOARD_DISCOUNT_PERCENT,
      expiryDays: NO_BOARD_EXPIRY_DAYS,
      ensureCoupon: getOrCreateNoBoardCoupon,
    },
    // The copy asks "not sure where to start? just reply" — that has to reach a
    // human, so it must not inherit the no-reply sending address.
    replyTo: SUPPORT_REPLY_TO_EMAIL,
  },
  {
    // Same template the hourly cron sends, exposed for manual sends so the
    // backlog of users who predate that cron can be reached. Both paths write
    // the same `lifecycle_emails` type, so a manual send to someone the cron
    // already mailed is skipped by the claim-first insert rather than duplicated.
    key: LIFECYCLE_EMAIL_TYPE_EMPTY_BOARD_NUDGE,
    label: 'Board but no cards',
    description: 'Has a board and has never made a card. No discount — the ask is "try it".',
    subject: emptyBoardNudgeSubject,
    render: (p: CampaignEmailProps): React.ReactElement =>
      EmptyBoardNudgeEmail({
        name: p.name,
        locale: p.locale,
        boardUrl: p.boardUrl,
        unsubscribeUrl: p.unsubscribeUrl,
        appUrl: p.appUrl,
      }) as React.ReactElement,
    replyTo: SUPPORT_REPLY_TO_EMAIL,
  },
];

export function getCampaignTemplate(key: string): CampaignTemplate | undefined {
  return CAMPAIGN_TEMPLATES.find((t) => t.key === key);
}

export function campaignTemplateOptions(): CampaignTemplateOption[] {
  return CAMPAIGN_TEMPLATES.map((t) => ({
    key: t.key,
    label: t.label,
    hasDiscount: Boolean(t.discount),
  }));
}
