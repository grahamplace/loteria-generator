// __tests__/emails/password-reset.test.tsx
import { describe, it, expect } from 'vitest';
import { render } from '@react-email/render';
import { PasswordResetEmail, passwordResetSubject } from '@/emails/password-reset';

const baseProps = {
  resetUrl: 'https://example.com/api/auth/reset-password/tok123?callbackURL=%2Freset-password',
  appUrl: 'https://example.com',
};

describe('PasswordResetEmail', () => {
  it('renders the reset link in English', async () => {
    const html = await render(PasswordResetEmail({ name: 'Ana', locale: 'en', ...baseProps }));
    expect(html).toContain(baseProps.resetUrl);
    expect(html).toContain('Reset your password');
  });

  it('renders Spanish without throwing and keeps the link', async () => {
    const html = await render(PasswordResetEmail({ name: 'Ana', locale: 'es', ...baseProps }));
    expect(html).toContain(baseProps.resetUrl);
    expect(html).toContain('Restablece tu contraseña');
  });

  it('carries no unsubscribe link — it is transactional', async () => {
    const html = await render(PasswordResetEmail({ name: 'Ana', locale: 'en', ...baseProps }));
    expect(html.toLowerCase()).not.toContain('unsubscribe');
    expect(html).not.toContain('/unsubscribe');
  });

  it('carries no discount code or redeem link', async () => {
    const html = await render(PasswordResetEmail({ name: 'Ana', locale: 'en', ...baseProps }));
    expect(html).not.toContain('/redeem');
    expect(html).not.toContain('% off');
  });

  it('states the one-hour expiry in both locales', async () => {
    const en = await render(PasswordResetEmail({ name: 'Ana', locale: 'en', ...baseProps }));
    const es = await render(PasswordResetEmail({ name: 'Ana', locale: 'es', ...baseProps }));
    expect(en).toContain('one hour');
    expect(es).toContain('una hora');
  });

  it('reassures a recipient who did not request it', async () => {
    const html = await render(PasswordResetEmail({ name: 'Ana', locale: 'en', ...baseProps }));
    expect(html).toContain('you can safely ignore this email');
  });

  it('greets with only the first name when given a full name', async () => {
    const html = await render(
      PasswordResetEmail({ name: 'Ana Maria Garcia', locale: 'en', ...baseProps })
    );
    expect(html).toContain('Hi Ana,');
    expect(html).not.toContain('Ana Maria Garcia');
  });

  it('falls back to a generic greeting when the name is blank', async () => {
    const html = await render(PasswordResetEmail({ name: '', locale: 'en', ...baseProps }));
    expect(html).toContain('Hi there,');
  });

  it('renders the shared wordmark from appUrl but no example image', async () => {
    const html = await render(PasswordResetEmail({ name: 'Ana', locale: 'en', ...baseProps }));
    expect(html).toContain('https://example.com/email/wordmark.png');
    expect(html).not.toContain('loteria-process.png');
  });

  it('has distinct EN/ES subjects', () => {
    expect(passwordResetSubject('en')).not.toBe(passwordResetSubject('es'));
  });
});
