// __tests__/emails/signup-nudge.test.tsx
import { describe, it, expect } from 'vitest';
import { render } from '@react-email/render';
import { SignupNudgeEmail, signupNudgeSubject } from '@/emails/signup-nudge';

const baseProps = {
  discountCode: 'LOTERIA-7KQ2M9',
  redeemUrl: 'https://example.com/redeem?code=LOTERIA-7KQ2M9&boardId=abc',
};

describe('SignupNudgeEmail', () => {
  it('renders English with the code, discount, and redeem link', async () => {
    const html = await render(SignupNudgeEmail({ name: 'Ana', locale: 'en', ...baseProps }));
    expect(html).toContain('LOTERIA-7KQ2M9');
    expect(html).toContain('25%');
    expect(html).toContain('https://example.com/redeem?code=LOTERIA-7KQ2M9&amp;boardId=abc');
  });

  it('renders Spanish without throwing and includes the code', async () => {
    const html = await render(SignupNudgeEmail({ name: 'Ana', locale: 'es', ...baseProps }));
    expect(html).toContain('LOTERIA-7KQ2M9');
    expect(html.toLowerCase()).toContain('descuento');
  });

  it('has distinct EN/ES subjects', () => {
    expect(signupNudgeSubject('en')).not.toBe(signupNudgeSubject('es'));
  });
});
