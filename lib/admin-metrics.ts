// Pure helpers for the admin metrics page (app/(admin)/admin/metrics).

export const METRICS_RANGES = [
  { key: '7d', label: '7 days' },
  { key: '30d', label: '30 days' },
  { key: '90d', label: '90 days' },
  { key: 'mtd', label: 'This month' },
  { key: 'all', label: 'All time' },
] as const;

export type MetricsRange = (typeof METRICS_RANGES)[number]['key'];

export const DEFAULT_METRICS_RANGE: MetricsRange = '30d';

export function parseMetricsRange(value: string | string[] | undefined): MetricsRange {
  return METRICS_RANGES.some((r) => r.key === value)
    ? (value as MetricsRange)
    : DEFAULT_METRICS_RANGE;
}

/**
 * Start of the window (inclusive), or null for all time. Day-based ranges are
 * rolling; 'mtd' starts at midnight UTC on the 1st, matching how timestamps
 * are stored.
 */
export function metricsRangeStart(range: MetricsRange, now: Date = new Date()): Date | null {
  const DAY_MS = 24 * 60 * 60 * 1000;
  switch (range) {
    case '7d':
      return new Date(now.getTime() - 7 * DAY_MS);
    case '30d':
      return new Date(now.getTime() - 30 * DAY_MS);
    case '90d':
      return new Date(now.getTime() - 90 * DAY_MS);
    case 'mtd':
      return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
    case 'all':
      return null;
  }
}

/** part / whole as a whole-number percent, or null when whole is 0. */
export function percentOf(part: number, whole: number): number | null {
  return whole === 0 ? null : Math.round((part / whole) * 100);
}

export function formatCents(cents: number, currency: string = 'usd'): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: currency.toUpperCase(),
  }).format(cents / 100);
}

/** One-line description of what was paid for a board, or null if unpaid. */
export function describeBoardPayment(board: {
  stripePaymentId: string | null;
  amountPaidCents: number | null;
  amountDiscountCents: number | null;
  amountRefundedCents: number;
  currency: string | null;
  promotionCode: string | null;
}): string | null {
  if (!board.stripePaymentId) return null;
  if (board.amountPaidCents === null) return 'Paid (amount not recorded)';

  const currency = board.currency ?? undefined;
  let text = formatCents(board.amountPaidCents, currency);
  if (board.promotionCode || board.amountDiscountCents) {
    const parts = [
      board.promotionCode && `code ${board.promotionCode}`,
      board.amountDiscountCents && `−${formatCents(board.amountDiscountCents, currency)}`,
    ].filter(Boolean);
    text += ` (${parts.join(', ')})`;
  }
  if (board.amountRefundedCents > 0) {
    text += `, ${formatCents(board.amountRefundedCents, currency)} refunded`;
  }
  return text;
}
