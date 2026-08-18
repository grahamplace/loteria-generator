// __tests__/emails/empty-board-nudge.test.tsx
import { describe, it, expect } from 'vitest';
import { render } from '@react-email/render';
import { EmptyBoardNudgeEmail, emptyBoardNudgeSubject } from '@/emails/empty-board-nudge';

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

  it('carries no discount code or redeem link', async () => {
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
