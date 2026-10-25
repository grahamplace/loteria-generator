// __tests__/emails/themes-launch.test.tsx
import { describe, it, expect } from 'vitest';
import { render } from '@react-email/render';
import { ThemesLaunchEmail, themesLaunchSubject } from '@/emails/themes-launch';

const baseProps = {
  discountCode: 'THEMES-7KQ2M9',
  redeemUrl: 'https://example.com/redeem?code=THEMES-7KQ2M9&boardId=b1',
  unsubscribeUrl: 'https://example.com/unsubscribe?token=tok123&lang=en',
  appUrl: 'https://example.com',
};

describe('ThemesLaunchEmail', () => {
  it('greets by first name and shows the code and redeem link', async () => {
    const html = await render(
      ThemesLaunchEmail({ name: 'Ana Maria Garcia', locale: 'en', ...baseProps })
    );
    expect(html).toContain('Hi Ana,');
    expect(html).toContain('THEMES-7KQ2M9');
    expect(html).toContain('redeem?code=THEMES-7KQ2M9&amp;boardId=b1');
    expect(html).toContain('unsubscribe?token=tok123');
  });

  it('shows the Halloween board and the smaller theme boards from appUrl', async () => {
    const html = await render(ThemesLaunchEmail({ name: 'Ana', locale: 'en', ...baseProps }));
    for (const file of [
      'themes-halloween-board.jpg',
      'themes-christmas-board.jpg',
      'themes-quinceanera-board.jpg',
      'themes-wedding-board.jpg',
    ]) {
      expect(html).toContain(`https://example.com/email/${file}`);
    }
  });

  it('renders ES copy when locale is es', async () => {
    const html = await render(ThemesLaunchEmail({ name: 'Ana', locale: 'es', ...baseProps }));
    expect(html).toContain('Hola Ana,');
    expect(html).toContain('Navidad');
    expect(html.toLowerCase()).toContain('descuento');
  });

  it('has distinct en/es subjects announcing custom themes', () => {
    expect(themesLaunchSubject('en')).toBe('New in Lotería Generator: Custom Themes');
    expect(themesLaunchSubject('es')).toBe('Nuevo en Lotería Generator: temas personalizados');
  });
});
