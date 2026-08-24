// emails/empty-board-nudge.tsx
//
// Sent to users who signed up and got a board but never made a single card.
//
// Two senders, two shapes. The hourly cron mails people 24-48h after signup and
// passes no discount: the ask there is "come try it", and the copy ends on a
// plain CTA into their board. The manual admin campaign chases a much older
// backlog and passes a one-time code, which swaps that CTA for the discount
// callout. Everything else — heading, body, reply invitation — is shared, so
// the two never drift apart.
import * as React from 'react';
import { Heading, Text } from '@react-email/components';
import { EMPTY_BOARD_DISCOUNT_PERCENT, EMPTY_BOARD_EXPIRY_DAYS } from '@/lib/constants';
import { firstName } from '@/lib/email/first-name';
import {
  LoteriaEmailLayout,
  CtaButton,
  DiscountCallout,
  EMAIL_COLORS,
  headingStyle,
  paragraphStyle,
  leadStyle,
} from './components/layout';

export type EmptyBoardNudgeEmailProps = {
  name: string;
  locale: 'en' | 'es';
  /** Deep link to the user's board (falls back to the app root upstream). */
  boardUrl: string;
  unsubscribeUrl: string;
  /** Absolute base URL (e.g. https://…) used to build public asset URLs for the email. */
  appUrl: string;
  /**
   * One-time promo code. Supplied by the manual campaign only — omit it (as the
   * cron does) and the email renders its plain, no-discount CTA instead.
   */
  discountCode?: string;
  /** Redeem link for `discountCode`; required alongside it, ignored without it. */
  redeemUrl?: string;
};

const COPY = {
  en: {
    preview: 'Your Lotería board is waiting — turn your photos into cards',
    previewDiscount: `Your Lotería board is waiting — here's ${EMPTY_BOARD_DISCOUNT_PERCENT}% off`,
    heading: 'Don’t Forget to Try Our Custom Lotería Generator',
    greeting: (n: string) => `Hi ${n},`,
    body: 'You signed up for Lotería Generator but haven’t added any cards yet. Upload a few photos — family, friends, pets, inside jokes — and we turn each one into a hand-illustrated Lotería card.',
    nudge:
      'Your board is still right where you left it. Adding your first card takes about a minute.',
    cta: 'Create your first card',
    discountLead: `And to help you get going, here’s ${EMPTY_BOARD_DISCOUNT_PERCENT}% off:`,
    discountCta: `Add your first card — ${EMPTY_BOARD_DISCOUNT_PERCENT}% off`,
    expires: `This code is one-time use and expires in ${EMPTY_BOARD_EXPIRY_DAYS} days.`,
    help: 'Need help? Feel free to reply to this email with any questions.',
    footer: 'You’re receiving this because you signed up for Lotería Generator.',
    unsubscribe: 'Unsubscribe',
  },
  es: {
    preview: 'Tu tabla de Lotería te espera — convierte tus fotos en cartas',
    previewDiscount: `Tu tabla de Lotería te espera — aquí tienes ${EMPTY_BOARD_DISCOUNT_PERCENT}% de descuento`,
    heading: 'No olvides probar nuestro generador de Lotería personalizada',
    greeting: (n: string) => `Hola ${n},`,
    body: 'Te registraste en Lotería Generator pero todavía no has agregado ninguna carta. Sube algunas fotos — de tu familia, amigos, mascotas o chistes internos — y convertimos cada una en una carta de Lotería ilustrada a mano.',
    nudge:
      'Tu tabla sigue justo donde la dejaste. Agregar tu primera carta toma alrededor de un minuto.',
    cta: 'Crea tu primera carta',
    discountLead: `Y para animarte a empezar, aquí tienes un ${EMPTY_BOARD_DISCOUNT_PERCENT}% de descuento:`,
    discountCta: `Agrega tu primera carta — ${EMPTY_BOARD_DISCOUNT_PERCENT}% de descuento`,
    expires: `Este código es de un solo uso y vence en ${EMPTY_BOARD_EXPIRY_DAYS} días.`,
    help: '¿Necesitas ayuda? Responde a este correo con cualquier pregunta.',
    footer: 'Recibes esto porque te registraste en Lotería Generator.',
    unsubscribe: 'Cancelar suscripción',
  },
};

export function emptyBoardNudgeSubject(locale: 'en' | 'es'): string {
  return locale === 'es'
    ? 'No olvides probar tu Lotería personalizada'
    : 'Don’t forget to try your custom Lotería';
}

const helpNoteStyle = {
  ...paragraphStyle,
  backgroundColor: EMAIL_COLORS.cream,
  border: `1px solid ${EMAIL_COLORS.gold}`,
  borderRadius: '12px',
  padding: '14px 16px',
  margin: '20px 0 0',
  fontSize: '15px',
} as const;

export function EmptyBoardNudgeEmail({
  name,
  locale,
  boardUrl,
  unsubscribeUrl,
  appUrl,
  discountCode,
  redeemUrl,
}: EmptyBoardNudgeEmailProps) {
  const t = COPY[locale] ?? COPY.en;
  // Both halves are required: a code with nowhere to redeem it is worse than no
  // code at all, so fall back to the plain CTA unless the pair is complete.
  const hasDiscount = Boolean(discountCode && redeemUrl);

  return (
    <LoteriaEmailLayout
      locale={locale}
      preview={hasDiscount ? t.previewDiscount : t.preview}
      appUrl={appUrl}
      unsubscribeUrl={unsubscribeUrl}
      footerText={t.footer}
      unsubscribeLabel={t.unsubscribe}
      showExampleImage
    >
      <Heading style={headingStyle}>{t.heading}</Heading>
      <Text style={paragraphStyle}>{t.greeting(firstName(name))}</Text>
      <Text style={paragraphStyle}>{t.body}</Text>
      <Text style={paragraphStyle}>{t.nudge}</Text>
      {hasDiscount ? (
        <>
          <Text style={leadStyle}>{t.discountLead}</Text>
          <DiscountCallout
            discountCode={discountCode!}
            redeemUrl={redeemUrl!}
            cta={t.discountCta}
            expires={t.expires}
          />
        </>
      ) : (
        <CtaButton href={boardUrl} label={t.cta} />
      )}
      <Text style={helpNoteStyle}>{t.help}</Text>
    </LoteriaEmailLayout>
  );
}

// Sample data the React Email preview server (`pnpm email:dev`) renders with.
// Shows the discounted variant; drop `discountCode`/`redeemUrl` to preview the
// plain CTA the cron sends.
EmptyBoardNudgeEmail.PreviewProps = {
  name: 'Ana',
  locale: 'en',
  boardUrl: 'http://localhost:3006/boards/demo',
  unsubscribeUrl: 'http://localhost:3006/unsubscribe?token=demo-token&lang=en',
  appUrl: 'http://localhost:3006',
  discountCode: 'LOTERIA-7KQ2M9',
  redeemUrl: 'http://localhost:3006/redeem?code=LOTERIA-7KQ2M9&boardId=demo',
} satisfies EmptyBoardNudgeEmailProps;

export default EmptyBoardNudgeEmail;
