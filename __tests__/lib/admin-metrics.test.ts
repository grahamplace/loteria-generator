import { describe, it, expect } from 'vitest';
import {
  describeBoardPayment,
  formatCents,
  metricsRangeStart,
  parseMetricsRange,
  percentOf,
} from '@/lib/admin-metrics';

const NOW = new Date('2026-10-24T15:30:00Z');

describe('parseMetricsRange', () => {
  it('accepts known ranges', () => {
    expect(parseMetricsRange('7d')).toBe('7d');
    expect(parseMetricsRange('all')).toBe('all');
  });

  it('falls back to 30d for missing or unknown values', () => {
    expect(parseMetricsRange(undefined)).toBe('30d');
    expect(parseMetricsRange('1y')).toBe('30d');
    expect(parseMetricsRange(['7d', '90d'])).toBe('30d');
  });
});

describe('metricsRangeStart', () => {
  it('rolls day-based ranges back from now', () => {
    expect(metricsRangeStart('7d', NOW)?.toISOString()).toBe('2026-10-17T15:30:00.000Z');
    expect(metricsRangeStart('90d', NOW)?.toISOString()).toBe('2026-07-26T15:30:00.000Z');
  });

  it('starts month-to-date at midnight UTC on the 1st', () => {
    expect(metricsRangeStart('mtd', NOW)?.toISOString()).toBe('2026-10-01T00:00:00.000Z');
  });

  it('has no start for all time', () => {
    expect(metricsRangeStart('all', NOW)).toBeNull();
  });
});

describe('percentOf', () => {
  it('rounds to a whole percent', () => {
    expect(percentOf(1, 3)).toBe(33);
  });

  it('is null when the base is zero', () => {
    expect(percentOf(0, 0)).toBeNull();
  });
});

describe('formatCents', () => {
  it('formats cents as currency', () => {
    expect(formatCents(2000)).toBe('$20.00');
    expect(formatCents(1050, 'usd')).toBe('$10.50');
  });
});

describe('describeBoardPayment', () => {
  const base = {
    stripePaymentId: 'pi_1',
    amountPaidCents: 2000,
    amountDiscountCents: 0,
    amountRefundedCents: 0,
    currency: 'usd',
    promotionCode: null,
  };

  it('is null for unpaid boards', () => {
    expect(describeBoardPayment({ ...base, stripePaymentId: null })).toBeNull();
  });

  it('shows a full-price payment', () => {
    expect(describeBoardPayment(base)).toBe('$20.00');
  });

  it('shows the code, discount and refund', () => {
    expect(
      describeBoardPayment({
        ...base,
        amountPaidCents: 1000,
        amountDiscountCents: 1000,
        promotionCode: 'WELCOME50',
        amountRefundedCents: 1000,
      })
    ).toBe('$10.00 (code WELCOME50, −$10.00), $10.00 refunded');
  });

  it('flags payments not yet backfilled', () => {
    expect(describeBoardPayment({ ...base, amountPaidCents: null })).toBe(
      'Paid (amount not recorded)'
    );
  });
});
