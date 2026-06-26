// emails/signup-nudge.tsx
import * as React from 'react';
import { Heading, Text } from '@react-email/components';
import { SIGNUP_NUDGE_DISCOUNT_PERCENT, SIGNUP_NUDGE_EXPIRY_DAYS } from '@/lib/constants';
import { firstName } from '@/lib/email/first-name';
import {
  LoteriaEmailLayout,
  DiscountCallout,
  headingStyle,
  paragraphStyle,
  leadStyle,
} from './components/layout';

export type SignupNudgeEmailProps = {
  name: string;
  locale: 'en' | 'es';
  discountCode: string;
  redeemUrl: string;
  unsubscribeUrl: string;
  /** Absolute base URL (e.g. https://…) used to build public asset URLs for the email. */
  appUrl: string;
};

const COPY = {
  en: {
    preview: `Your ${SIGNUP_NUDGE_DISCOUNT_PERCENT}% off code is inside`,
    heading: 'Finish Your Lotería Set',
    greeting: (n: string) => `Hi ${n},`,
    body: 'You started something beautiful — your custom Lotería cards are looking great. Unlock the full board to get all 54 cards and a full ready-to-print set of 50 boards and a deck of calling cards.',
    discountLead: `As a thank-you, here is ${SIGNUP_NUDGE_DISCOUNT_PERCENT}% off, just for you:`,
    expires: `This code is one-time use and expires in ${SIGNUP_NUDGE_EXPIRY_DAYS} days.`,
    cta: `Unlock with ${SIGNUP_NUDGE_DISCOUNT_PERCENT}% off`,
    footer: 'You are receiving this because you created a Lotería board.',
    unsubscribe: 'Unsubscribe',
  },
  es: {
    preview: `Tu código de ${SIGNUP_NUDGE_DISCOUNT_PERCENT}% de descuento está adentro`,
    heading: 'Termina tu juego de Lotería',
    greeting: (n: string) => `Hola ${n},`,
    body: 'Empezaste algo hermoso — tus cartas de Lotería se ven geniales. Desbloquea la tabla completa para obtener las 54 cartas y un juego completo listo para imprimir de 50 tablas y un mazo de cartas para cantar.',
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
  appUrl,
}: SignupNudgeEmailProps) {
  const t = COPY[locale] ?? COPY.en;
  return (
    <LoteriaEmailLayout
      locale={locale}
      preview={t.preview}
      appUrl={appUrl}
      unsubscribeUrl={unsubscribeUrl}
      footerText={t.footer}
      unsubscribeLabel={t.unsubscribe}
      showExampleImage
    >
      <Heading style={headingStyle}>{t.heading}</Heading>
      <Text style={paragraphStyle}>{t.greeting(firstName(name))}</Text>
      <Text style={paragraphStyle}>{t.body}</Text>
      <Text style={leadStyle}>{t.discountLead}</Text>
      <DiscountCallout
        discountCode={discountCode}
        redeemUrl={redeemUrl}
        cta={t.cta}
        expires={t.expires}
      />
    </LoteriaEmailLayout>
  );
}

// Sample data the React Email preview server (`pnpm email:dev`) renders with.
SignupNudgeEmail.PreviewProps = {
  name: 'Ana',
  locale: 'en',
  discountCode: 'LOTERIA-7KQ2M9',
  redeemUrl: 'http://localhost:3006/redeem?code=LOTERIA-7KQ2M9&boardId=demo',
  unsubscribeUrl: 'http://localhost:3006/unsubscribe?token=demo-token&lang=en',
  appUrl: 'http://localhost:3006',
} satisfies SignupNudgeEmailProps;

export default SignupNudgeEmail;
