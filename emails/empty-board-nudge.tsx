// emails/empty-board-nudge.tsx
//
// Sent to users who signed up and got a board but never made a single card.
// Deliberately has no discount: the ask is "come try it", not "come buy it",
// and it invites a reply so a stuck user can just answer the email.
import * as React from 'react';
import { Heading, Text } from '@react-email/components';
import { firstName } from '@/lib/email/first-name';
import {
  LoteriaEmailLayout,
  CtaButton,
  EMAIL_COLORS,
  headingStyle,
  paragraphStyle,
} from './components/layout';

export type EmptyBoardNudgeEmailProps = {
  name: string;
  locale: 'en' | 'es';
  /** Deep link to the user's board (falls back to the app root upstream). */
  boardUrl: string;
  unsubscribeUrl: string;
  /** Absolute base URL (e.g. https://…) used to build public asset URLs for the email. */
  appUrl: string;
};

const COPY = {
  en: {
    preview: 'Your Lotería board is waiting — turn your photos into cards',
    heading: 'Don’t Forget to Try Our Custom Lotería Generator',
    greeting: (n: string) => `Hi ${n},`,
    body: 'You signed up for Lotería Generator but haven’t added any cards yet. Upload a few photos — family, friends, pets, inside jokes — and we turn each one into a hand-illustrated Lotería card.',
    nudge:
      'Your board is still right where you left it. Adding your first card takes about a minute.',
    cta: 'Create your first card',
    help: 'Need help? Feel free to reply to this email with any questions.',
    footer: 'You’re receiving this because you signed up for Lotería Generator.',
    unsubscribe: 'Unsubscribe',
  },
  es: {
    preview: 'Tu tabla de Lotería te espera — convierte tus fotos en cartas',
    heading: 'No olvides probar nuestro generador de Lotería personalizada',
    greeting: (n: string) => `Hola ${n},`,
    body: 'Te registraste en Lotería Generator pero todavía no has agregado ninguna carta. Sube algunas fotos — de tu familia, amigos, mascotas o chistes internos — y convertimos cada una en una carta de Lotería ilustrada a mano.',
    nudge:
      'Tu tabla sigue justo donde la dejaste. Agregar tu primera carta toma alrededor de un minuto.',
    cta: 'Crea tu primera carta',
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
}: EmptyBoardNudgeEmailProps) {
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
      <CtaButton href={boardUrl} label={t.cta} />
      <Text style={helpNoteStyle}>{t.help}</Text>
    </LoteriaEmailLayout>
  );
}

// Sample data the React Email preview server (`pnpm email:dev`) renders with.
EmptyBoardNudgeEmail.PreviewProps = {
  name: 'Ana',
  locale: 'en',
  boardUrl: 'http://localhost:3006/boards/demo',
  unsubscribeUrl: 'http://localhost:3006/unsubscribe?token=demo-token&lang=en',
  appUrl: 'http://localhost:3006',
} satisfies EmptyBoardNudgeEmailProps;

export default EmptyBoardNudgeEmail;
