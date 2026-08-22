// emails/password-reset.tsx
//
// Transactional: sent only when someone asks to reset the password on their own
// account. Deliberately has no unsubscribe link, no discount, and no marketing
// imagery — a locked-out user must be able to get back in regardless of any
// marketing opt-out.
import * as React from 'react';
import { Heading, Text, Link } from '@react-email/components';
import { firstName } from '@/lib/email/first-name';
import {
  LoteriaEmailLayout,
  CtaButton,
  EMAIL_COLORS,
  headingStyle,
  paragraphStyle,
} from './components/layout';

export type PasswordResetEmailProps = {
  name: string;
  locale: 'en' | 'es';
  /** The full better-auth reset URL, already carrying the token. */
  resetUrl: string;
  /** Absolute base URL (e.g. https://…) used to build public asset URLs. */
  appUrl: string;
};

const COPY = {
  en: {
    preview: 'Reset your Lotería Generator password',
    heading: 'Reset your password',
    greeting: (n: string) => (n ? `Hi ${n},` : 'Hi there,'),
    body: 'Someone asked to reset the password for your Lotería Generator account. Click the button below to choose a new one.',
    cta: 'Reset your password',
    fallbackIntro: 'If the button doesn’t work, copy and paste this link into your browser:',
    expiry: 'This link expires in one hour and can only be used once.',
    ignore:
      'If you didn’t ask for this, you can safely ignore this email — your password stays the same.',
    footer:
      'You’re receiving this because someone requested a password reset for your Lotería Generator account.',
  },
  es: {
    preview: 'Restablece tu contraseña de Lotería Generator',
    heading: 'Restablece tu contraseña',
    greeting: (n: string) => (n ? `Hola ${n},` : 'Hola,'),
    body: 'Alguien solicitó restablecer la contraseña de tu cuenta de Lotería Generator. Haz clic en el botón de abajo para elegir una nueva.',
    cta: 'Restablecer mi contraseña',
    fallbackIntro: 'Si el botón no funciona, copia y pega este enlace en tu navegador:',
    expiry: 'Este enlace vence en una hora y solo se puede usar una vez.',
    ignore: 'Si no lo solicitaste, puedes ignorar este correo — tu contraseña no cambiará.',
    footer:
      'Recibes esto porque alguien solicitó restablecer la contraseña de tu cuenta de Lotería Generator.',
  },
};

const fineprintStyle = {
  ...paragraphStyle,
  color: EMAIL_COLORS.muted,
  fontSize: '14px',
  marginTop: '16px',
} as const;

const linkFallbackStyle = {
  ...fineprintStyle,
  wordBreak: 'break-all' as const,
};

export function passwordResetSubject(locale: 'en' | 'es'): string {
  return locale === 'es'
    ? 'Restablece tu contraseña de Lotería Generator'
    : 'Reset your Lotería Generator password';
}

export function PasswordResetEmail({ name, locale, resetUrl, appUrl }: PasswordResetEmailProps) {
  const c = COPY[locale];
  return (
    <LoteriaEmailLayout locale={locale} preview={c.preview} appUrl={appUrl} footerText={c.footer}>
      <Heading style={headingStyle}>{c.heading}</Heading>
      <Text style={paragraphStyle}>{c.greeting(firstName(name))}</Text>
      <Text style={paragraphStyle}>{c.body}</Text>
      <CtaButton href={resetUrl} label={c.cta} />
      <Text style={fineprintStyle}>{c.fallbackIntro}</Text>
      <Text style={linkFallbackStyle}>
        <Link href={resetUrl} style={{ color: EMAIL_COLORS.primary }}>
          {resetUrl}
        </Link>
      </Text>
      <Text style={fineprintStyle}>{c.expiry}</Text>
      <Text style={fineprintStyle}>{c.ignore}</Text>
    </LoteriaEmailLayout>
  );
}
