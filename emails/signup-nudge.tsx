// emails/signup-nudge.tsx
import * as React from 'react';
import {
  Html,
  Head,
  Preview,
  Body,
  Container,
  Section,
  Heading,
  Text,
  Button,
  Hr,
  Link,
} from '@react-email/components';
import { SIGNUP_NUDGE_DISCOUNT_PERCENT, SIGNUP_NUDGE_EXPIRY_DAYS } from '@/lib/constants';

export type SignupNudgeEmailProps = {
  name: string;
  locale: 'en' | 'es';
  discountCode: string;
  redeemUrl: string;
  unsubscribeUrl: string;
};

const COLORS = {
  primary: '#C8442C',
  gold: '#E2A53C',
  cream: '#FAF5E6',
  brown: '#3D2B1F',
  card: '#FFFFFF',
};

const COPY = {
  en: {
    preview: `Your ${SIGNUP_NUDGE_DISCOUNT_PERCENT}% off code is inside`,
    heading: 'Finish your Lotería board',
    greeting: (n: string) => `Hi ${n},`,
    body: 'You started something beautiful — your custom Lotería cards are looking great. Unlock the full board to get all 54 cards and unlimited exports.',
    discountLead: `As a thank-you, here is ${SIGNUP_NUDGE_DISCOUNT_PERCENT}% off, just for you:`,
    expires: `This code is one-time use and expires in ${SIGNUP_NUDGE_EXPIRY_DAYS} days.`,
    cta: `Unlock with ${SIGNUP_NUDGE_DISCOUNT_PERCENT}% off`,
    footer: 'You are receiving this because you created a Lotería board.',
    unsubscribe: 'Unsubscribe',
  },
  es: {
    preview: `Tu código de ${SIGNUP_NUDGE_DISCOUNT_PERCENT}% de descuento está adentro`,
    heading: 'Termina tu tabla de Lotería',
    greeting: (n: string) => `Hola ${n},`,
    body: 'Empezaste algo hermoso — tus cartas de Lotería se ven geniales. Desbloquea la tabla completa para obtener las 54 cartas y exportaciones ilimitadas.',
    discountLead: `Como agradecimiento, aquí tienes un ${SIGNUP_NUDGE_DISCOUNT_PERCENT}% de descuento, solo para ti:`,
    expires: `Este código es de un solo uso y vence en ${SIGNUP_NUDGE_EXPIRY_DAYS} días.`,
    cta: `Desbloquear con ${SIGNUP_NUDGE_DISCOUNT_PERCENT}% de descuento`,
    footer: 'Recibes esto porque creaste una tabla de Lotería.',
    unsubscribe: 'Cancelar suscripción',
  },
};

export function signupNudgeSubject(locale: 'en' | 'es'): string {
  return locale === 'es'
    ? `🎉 ${SIGNUP_NUDGE_DISCOUNT_PERCENT}% de descuento para terminar tu Lotería`
    : `🎉 ${SIGNUP_NUDGE_DISCOUNT_PERCENT}% off to finish your Lotería board`;
}

export function SignupNudgeEmail({
  name,
  locale,
  discountCode,
  redeemUrl,
  unsubscribeUrl,
}: SignupNudgeEmailProps) {
  const t = COPY[locale] ?? COPY.en;
  return (
    <Html lang={locale}>
      <Head />
      <Preview>{t.preview}</Preview>
      <Body style={{ backgroundColor: COLORS.cream, margin: 0, fontFamily: 'Georgia, serif' }}>
        <Container style={{ maxWidth: '480px', margin: '0 auto', padding: '32px 24px' }}>
          <Section
            style={{
              backgroundColor: COLORS.card,
              borderRadius: '16px',
              border: `1px solid ${COLORS.gold}`,
              padding: '32px',
            }}
          >
            <Heading style={{ color: COLORS.primary, fontSize: '24px', margin: '0 0 16px' }}>
              {t.heading}
            </Heading>
            <Text style={{ color: COLORS.brown, fontSize: '16px', lineHeight: '24px' }}>
              {t.greeting(name)}
            </Text>
            <Text style={{ color: COLORS.brown, fontSize: '16px', lineHeight: '24px' }}>
              {t.body}
            </Text>
            <Text
              style={{
                color: COLORS.brown,
                fontSize: '16px',
                lineHeight: '24px',
                marginTop: '16px',
              }}
            >
              {t.discountLead}
            </Text>
            <Section
              style={{
                backgroundColor: COLORS.cream,
                border: `2px dashed ${COLORS.primary}`,
                borderRadius: '12px',
                padding: '16px',
                textAlign: 'center' as const,
                margin: '8px 0 16px',
              }}
            >
              <Text
                style={{
                  color: COLORS.primary,
                  fontSize: '26px',
                  fontWeight: 'bold',
                  letterSpacing: '2px',
                  margin: 0,
                  fontFamily: 'monospace',
                }}
              >
                {discountCode}
              </Text>
            </Section>
            <Button
              href={redeemUrl}
              style={{
                backgroundColor: COLORS.primary,
                color: '#ffffff',
                borderRadius: '12px',
                padding: '14px 24px',
                fontSize: '16px',
                fontWeight: 'bold',
                textDecoration: 'none',
                display: 'block',
                textAlign: 'center' as const,
              }}
            >
              {t.cta}
            </Button>
            <Text
              style={{
                color: COLORS.brown,
                fontSize: '13px',
                textAlign: 'center' as const,
                marginTop: '12px',
              }}
            >
              {t.expires}
            </Text>
            <Hr style={{ borderColor: COLORS.gold, margin: '24px 0' }} />
            <Text style={{ color: '#8a7a6a', fontSize: '12px', lineHeight: '18px' }}>
              {t.footer}{' '}
              <Link href={unsubscribeUrl} style={{ color: '#8a7a6a', textDecoration: 'underline' }}>
                {t.unsubscribe}
              </Link>
            </Text>
          </Section>
        </Container>
      </Body>
    </Html>
  );
}

// Sample data the React Email preview server (`pnpm email:dev`) renders with.
SignupNudgeEmail.PreviewProps = {
  name: 'Ana',
  locale: 'en',
  discountCode: 'LOTERIA-7KQ2M9',
  redeemUrl: 'http://localhost:3006/redeem?code=LOTERIA-7KQ2M9&boardId=demo',
  unsubscribeUrl: 'http://localhost:3006/unsubscribe?token=demo-token&lang=en',
} satisfies SignupNudgeEmailProps;

export default SignupNudgeEmail;
