// emails/reengagement.tsx
import * as React from 'react';
import { Heading, Text } from '@react-email/components';
import { REENGAGEMENT_DISCOUNT_PERCENT, REENGAGEMENT_EXPIRY_DAYS } from '@/lib/constants';
import { firstName } from '@/lib/email/first-name';
import {
  LoteriaEmailLayout,
  DiscountCallout,
  headingStyle,
  paragraphStyle,
  leadStyle,
} from './components/layout';

export type ReengagementEmailProps = {
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
    preview: `We've made Lotería Generator better — here's ${REENGAGEMENT_DISCOUNT_PERCENT}% off`,
    heading: 'Still Interested in Custom Lotería?',
    greeting: (n: string) => `Hi ${n},`,
    body: "I saw you recently signed up for Lotería Generator — since you last checked it out we've made tons of improvements. If you're still looking for a custom Lotería set for your quinceañera, wedding, family reunion, or any other event, give it another try!",
    discountLead: `Here's ${REENGAGEMENT_DISCOUNT_PERCENT}% off, just for you:`,
    expires: `This code is one-time use and expires in ${REENGAGEMENT_EXPIRY_DAYS} days.`,
    cta: `Try it again with ${REENGAGEMENT_DISCOUNT_PERCENT}% off`,
    footer: 'You’re receiving this because you signed up for Lotería Generator.',
    unsubscribe: 'Unsubscribe',
  },
  es: {
    preview: `Hemos mejorado Lotería Generator — aquí tienes ${REENGAGEMENT_DISCOUNT_PERCENT}% de descuento`,
    heading: '¿Todavía te interesa una Lotería personalizada?',
    greeting: (n: string) => `Hola ${n},`,
    body: 'Vi que te registraste recientemente en Lotería Generator — desde tu última visita hemos hecho muchas mejoras. Si todavía buscas un juego de Lotería personalizado para tu quinceañera, boda, reunión familiar u otro evento, ¡dale otra oportunidad!',
    discountLead: `Aquí tienes un ${REENGAGEMENT_DISCOUNT_PERCENT}% de descuento, solo para ti:`,
    expires: `Este código es de un solo uso y vence en ${REENGAGEMENT_EXPIRY_DAYS} días.`,
    cta: `Inténtalo de nuevo con ${REENGAGEMENT_DISCOUNT_PERCENT}% de descuento`,
    footer: 'Recibes esto porque te registraste en Lotería Generator.',
    unsubscribe: 'Cancelar suscripción',
  },
};

export function reengagementSubject(locale: 'en' | 'es'): string {
  return locale === 'es'
    ? '¿Todavía te interesa una Lotería personalizada?'
    : 'Still Interested in Custom Lotería?';
}

export function ReengagementEmail({
  name,
  locale,
  discountCode,
  redeemUrl,
  unsubscribeUrl,
  appUrl,
}: ReengagementEmailProps) {
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
ReengagementEmail.PreviewProps = {
  name: 'Ana',
  locale: 'en',
  discountCode: 'LOTERIA-7KQ2M9',
  redeemUrl: 'http://localhost:3006/redeem?code=LOTERIA-7KQ2M9',
  unsubscribeUrl: 'http://localhost:3006/unsubscribe?token=demo-token&lang=en',
  appUrl: 'http://localhost:3006',
} satisfies ReengagementEmailProps;

export default ReengagementEmail;
