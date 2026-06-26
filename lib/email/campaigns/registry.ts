// lib/email/campaigns/registry.ts
import * as React from 'react';
import { ReengagementEmail, reengagementSubject } from '@/emails/reengagement';
import { getOrCreateReengagementCoupon } from '@/lib/stripe-promotions';
import {
  REENGAGEMENT_COUPON_ID,
  REENGAGEMENT_DISCOUNT_PERCENT,
  REENGAGEMENT_EXPIRY_DAYS,
  LIFECYCLE_EMAIL_TYPE_REENGAGEMENT,
} from '@/lib/constants';

export type CampaignEmailProps = {
  name: string;
  locale: 'en' | 'es';
  appUrl: string;
  unsubscribeUrl: string;
  discountCode?: string;
  redeemUrl?: string;
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
