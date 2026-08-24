// __tests__/emails/empty-board-nudge.test.tsx
import { describe, it, expect } from 'vitest';
import { render } from '@react-email/render';
import { EmptyBoardNudgeEmail, emptyBoardNudgeSubject } from '@/emails/empty-board-nudge';
import { EMPTY_BOARD_EXPIRY_DAYS } from '@/lib/constants';

const baseProps = {
  boardUrl: 'https://example.com/boards/abc',
  unsubscribeUrl: 'https://example.com/unsubscribe?token=tok123&lang=en',
  appUrl: 'https://example.com',
};

describe('EmptyBoardNudgeEmail', () => {
  it('renders English with the try-it heading and board link', async () => {
    const html = await render(EmptyBoardNudgeEmail({ name: 'Ana', locale: 'en', ...baseProps }));
    expect(html).toContain('https://example.com/boards/abc');
    expect(html).toContain('Create your first card');
    expect(html.toLowerCase()).toContain('don’t forget to try');
  });

  it('invites a reply for help', async () => {
    const html = await render(EmptyBoardNudgeEmail({ name: 'Ana', locale: 'en', ...baseProps }));
    expect(html).toContain('Need help? Feel free to reply to this email with any questions.');
  });

  it('renders Spanish without throwing and keeps the reply invitation', async () => {
    const html = await render(EmptyBoardNudgeEmail({ name: 'Ana', locale: 'es', ...baseProps }));
    expect(html).toContain('https://example.com/boards/abc');
    expect(html).toContain('¿Necesitas ayuda?');
  });

  it('carries no discount code or redeem link — this is the shape the cron sends', async () => {
    const html = await render(EmptyBoardNudgeEmail({ name: 'Ana', locale: 'en', ...baseProps }));
    expect(html).not.toContain('/redeem');
    expect(html).not.toContain('% off');
  });

  it('greets with only the first name when given a full name', async () => {
    const html = await render(
      EmptyBoardNudgeEmail({ name: 'Ana Maria Garcia', locale: 'en', ...baseProps })
    );
    expect(html).toContain('Hi Ana,');
    expect(html).not.toContain('Ana Maria Garcia');
  });

  it('renders the shared wordmark and example images from appUrl', async () => {
    const html = await render(EmptyBoardNudgeEmail({ name: 'Ana', locale: 'en', ...baseProps }));
    expect(html).toContain('https://example.com/email/wordmark.png');
    expect(html).toContain('https://example.com/email/loteria-process.png');
  });

  it('has distinct EN/ES subjects', () => {
    expect(emptyBoardNudgeSubject('en')).not.toBe(emptyBoardNudgeSubject('es'));
  });

  it('includes an unsubscribe link in the footer', async () => {
    const html = await render(EmptyBoardNudgeEmail({ name: 'Ana', locale: 'en', ...baseProps }));
    expect(html).toContain('unsubscribe?token=tok123');
    expect(html.toLowerCase()).toContain('unsubscribe');
  });
});

// The manual admin campaign passes a one-time code; the hourly cron does not.
// One component, two shapes — these lock in the branch between them.
describe('EmptyBoardNudgeEmail — discounted variant', () => {
  const discountProps = {
    ...baseProps,
    discountCode: 'LOTERIA-7KQ2M9',
    redeemUrl: 'https://example.com/redeem?code=LOTERIA-7KQ2M9&boardId=abc',
  };

  it('shows the code and points the CTA at the redeem link', async () => {
    const html = await render(
      EmptyBoardNudgeEmail({ name: 'Ana', locale: 'en', ...discountProps })
    );
    expect(html).toContain('LOTERIA-7KQ2M9');
    expect(html).toContain('https://example.com/redeem?code=LOTERIA-7KQ2M9&amp;boardId=abc');
  });

  it('replaces the plain CTA rather than showing both', async () => {
    const html = await render(
      EmptyBoardNudgeEmail({ name: 'Ana', locale: 'en', ...discountProps })
    );
    expect(html).not.toContain('Create your first card');
  });

  it('keeps the reply invitation and the unsubscribe link', async () => {
    const html = await render(
      EmptyBoardNudgeEmail({ name: 'Ana', locale: 'en', ...discountProps })
    );
    expect(html).toContain('Need help? Feel free to reply to this email with any questions.');
    expect(html).toContain('unsubscribe?token=tok123');
  });

  it('states the expiry so the code does not look open-ended', async () => {
    const html = await render(
      EmptyBoardNudgeEmail({ name: 'Ana', locale: 'en', ...discountProps })
    );
    expect(html).toContain(`${EMPTY_BOARD_EXPIRY_DAYS} days`);
  });

  it('renders the ES discount copy', async () => {
    const html = await render(
      EmptyBoardNudgeEmail({ name: 'Ana', locale: 'es', ...discountProps })
    );
    expect(html.toLowerCase()).toContain('descuento');
    expect(html).toContain('LOTERIA-7KQ2M9');
  });

  it('falls back to the plain CTA when a code arrives without a redeem link', async () => {
    // A code with nowhere to redeem it is worse than no code at all.
    const html = await render(
      EmptyBoardNudgeEmail({ name: 'Ana', locale: 'en', ...baseProps, discountCode: 'ORPHAN-CODE' })
    );
    expect(html).not.toContain('ORPHAN-CODE');
    expect(html).toContain('Create your first card');
  });
});
