// emails/no-board-nudge.tsx
//
// Sent to users who signed up and never created a board at all — they predate
// the auto-created first board (PR #63), so they never even saw the editor.
//
// Distinct from `empty-board-nudge`, which chases people who *have* a board and
// made zero cards. That audience has seen the product and needs a "come finish"
// message; this one never got that far, so the email has to re-sell the idea
// from scratch and sweeten it with a discount.
import * as React from 'react';
import { Heading, Text } from '@react-email/components';
import { NO_BOARD_DISCOUNT_PERCENT, NO_BOARD_EXPIRY_DAYS } from '@/lib/constants';
import { firstName } from '@/lib/email/first-name';
import {
  LoteriaEmailLayout,
  DiscountCallout,
  EMAIL_COLORS,
  headingStyle,
  paragraphStyle,
  leadStyle,
} from './components/layout';

export type NoBoardNudgeEmailProps = {
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
    preview: `Your custom Lotería is still waiting — here's ${NO_BOARD_DISCOUNT_PERCENT}% off`,
    heading: 'Ready to Make Your Own Lotería?',
    greeting: (n: string) => `Hi ${n},`,
    body: 'You signed up for Lotería Generator but never got as far as starting a board. It’s quicker than it looks: upload a few photos — family, friends, pets, inside jokes — and we turn each one into a hand-illustrated Lotería card you can print and play with.',
    nudge: 'We’ve also made a lot of improvements since you signed up, so it’s worth a fresh look.',
    discountLead: `To get you started, here’s ${NO_BOARD_DISCOUNT_PERCENT}% off:`,
    expires: `This code is one-time use and expires in ${NO_BOARD_EXPIRY_DAYS} days.`,
    cta: `Start your board with ${NO_BOARD_DISCOUNT_PERCENT}% off`,
    help: 'Not sure where to start? Feel free to reply to this email — a real person reads them.',
    footer: 'You’re receiving this because you signed up for Lotería Generator.',
    unsubscribe: 'Unsubscribe',
  },
  es: {
    preview: `Tu Lotería personalizada te sigue esperando — aquí tienes ${NO_BOARD_DISCOUNT_PERCENT}% de descuento`,
    heading: '¿Listo para crear tu propia Lotería?',
    greeting: (n: string) => `Hola ${n},`,
    body: 'Te registraste en Lotería Generator pero nunca llegaste a crear una tabla. Es más rápido de lo que parece: sube algunas fotos — de tu familia, amigos, mascotas o chistes internos — y convertimos cada una en una carta de Lotería ilustrada a mano que puedes imprimir y jugar.',
    nudge:
      'Además, hemos hecho muchas mejoras desde que te registraste, así que vale la pena echarle otro vistazo.',
    discountLead: `Para animarte a empezar, aquí tienes un ${NO_BOARD_DISCOUNT_PERCENT}% de descuento:`,
    expires: `Este código es de un solo uso y vence en ${NO_BOARD_EXPIRY_DAYS} días.`,
    cta: `Crea tu tabla con ${NO_BOARD_DISCOUNT_PERCENT}% de descuento`,
    help: '¿No sabes por dónde empezar? Responde a este correo — lo lee una persona real.',
    footer: 'Recibes esto porque te registraste en Lotería Generator.',
    unsubscribe: 'Cancelar suscripción',
  },
};

export function noBoardNudgeSubject(locale: 'en' | 'es'): string {
  return locale === 'es'
    ? '¿Listo para crear tu propia Lotería?'
    : 'Ready to Make Your Own Lotería?';
}

// Matches the callout in `empty-board-nudge`: a cream box that reads as an aside
// rather than a second call to action competing with the discount button.
const helpNoteStyle = {
  ...paragraphStyle,
  backgroundColor: EMAIL_COLORS.cream,
  border: `1px solid ${EMAIL_COLORS.gold}`,
  borderRadius: '12px',
  padding: '14px 16px',
  margin: '20px 0 0',
  fontSize: '15px',
} as const;

export function NoBoardNudgeEmail({
  name,
  locale,
  discountCode,
  redeemUrl,
  unsubscribeUrl,
  appUrl,
}: NoBoardNudgeEmailProps) {
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
      <Text style={paragraphStyle}>{t.nudge}</Text>
      <Text style={leadStyle}>{t.discountLead}</Text>
      <DiscountCallout
        discountCode={discountCode}
        redeemUrl={redeemUrl}
        cta={t.cta}
        expires={t.expires}
      />
      <Text style={helpNoteStyle}>{t.help}</Text>
    </LoteriaEmailLayout>
  );
}

// Sample data the React Email preview server (`pnpm email:dev`) renders with.
NoBoardNudgeEmail.PreviewProps = {
  name: 'Ana',
  locale: 'en',
  discountCode: 'LOTERIA-7KQ2M9',
  redeemUrl: 'http://localhost:3006/redeem?code=LOTERIA-7KQ2M9',
  unsubscribeUrl: 'http://localhost:3006/unsubscribe?token=demo-token&lang=en',
  appUrl: 'http://localhost:3006',
} satisfies NoBoardNudgeEmailProps;

export default NoBoardNudgeEmail;
