// emails/themes-launch.tsx
import * as React from 'react';
import { Heading, Text, Img, Section, Row, Column } from '@react-email/components';
import { THEMES_LAUNCH_DISCOUNT_PERCENT, THEMES_LAUNCH_EXPIRY_DAYS } from '@/lib/constants';
import { firstName } from '@/lib/email/first-name';
import {
  LoteriaEmailLayout,
  DiscountCallout,
  EMAIL_COLORS,
  headingStyle,
  paragraphStyle,
  leadStyle,
} from './components/layout';

export type ThemesLaunchEmailProps = {
  name: string;
  locale: 'en' | 'es';
  discountCode: string;
  redeemUrl: string;
  unsubscribeUrl: string;
  /** Absolute base URL (e.g. https://…) used to build public asset URLs for the email. */
  appUrl: string;
};

// Smaller boards shown under the Halloween hero, so the email reads as "many
// themes", not "a Halloween feature". Files live in `public/email/`.
const MORE_THEMES = [
  { file: 'themes-christmas-board.jpg', en: 'Christmas', es: 'Navidad' },
  { file: 'themes-quinceanera-board.jpg', en: 'Quinceañera', es: 'Quinceañera' },
  { file: 'themes-wedding-board.jpg', en: 'Wedding', es: 'Boda' },
] as const;

const COPY = {
  en: {
    preview: `Halloween is almost here: pick a theme, watch your set come together live, and take ${THEMES_LAUNCH_DISCOUNT_PERCENT}% off.`,
    heading: ['New in Lotería Generator:', 'Custom Themes'],
    greeting: (n: string) => `Hi ${n},`,
    body: [
      'We just released an exciting new feature in Lotería Generator: Custom Themes!',
      'You can use premade themes for Halloween, Christmas, quinceañeras, and more, or customize your Lotería set with whatever colors, fonts, and styles match your event.',
    ],
    heroAlt:
      'A Halloween Lotería board: dark purple background, cobweb corners, and 16 custom cards made from family photos',
    heroCaption:
      'Use the new spooky Halloween theme and add photos of your family’s favorite costumes.',
    whatsNew: 'What’s new',
    features: [
      '20+ themes for birthdays, weddings, holidays, quinceañeras, and more, each with its own colors, fonts, and border',
      'Live preview: as you add cards and customize your Lotería set, a live preview shows you exactly what your final boards will look like',
      'Have a specific idea in mind? Your Lotería set is now fully customizable. Use your team colors, match your party’s vibe, or just make it a little more your style. It’s up to you!',
    ],
    moreThemes: 'A few more themes',
    discountLead: `Trick or treat! Here’s a ${THEMES_LAUNCH_DISCOUNT_PERCENT}% off code to make a spooky Lotería set before Halloween:`,
    expires: `This code is one-time use and expires in ${THEMES_LAUNCH_EXPIRY_DAYS} days.`,
    cta: `Pick a theme with ${THEMES_LAUNCH_DISCOUNT_PERCENT}% off`,
    footer: 'You’re receiving this because you signed up for Lotería Generator.',
    unsubscribe: 'Unsubscribe',
  },
  es: {
    preview: `Halloween ya casi llega: elige un tema, mira cómo tu juego toma forma en vivo y llévate un ${THEMES_LAUNCH_DISCOUNT_PERCENT}% de descuento.`,
    heading: ['Nuevo en Lotería Generator:', 'Temas personalizados'],
    greeting: (n: string) => `Hola ${n},`,
    body: [
      'Acabamos de lanzar una nueva función en Lotería Generator: ¡temas personalizados!',
      'Puedes usar temas listos para Halloween, Navidad, quinceañeras y más, o personalizar tu Lotería con los colores, la tipografía y el estilo que vayan con tu evento.',
    ],
    heroAlt:
      'Una tabla de Lotería de Halloween: fondo morado oscuro, telarañas en las esquinas y 16 cartas hechas con fotos de familia',
    heroCaption:
      'Usa el nuevo y espeluznante tema de Halloween y agrega fotos de los disfraces favoritos de tu familia.',
    whatsNew: 'Lo nuevo',
    features: [
      'Más de 20 temas para cumpleaños, bodas, días festivos, quinceañeras y más, cada uno con sus propios colores, tipografía y borde',
      'Vista previa en vivo: mientras agregas cartas y personalizas tu Lotería, la vista previa te muestra exactamente cómo quedarán tus tablas',
      '¿Tienes algo específico en mente? Ahora tu Lotería es totalmente personalizable. Usa los colores de tu equipo, combínala con el ambiente de tu fiesta o simplemente dale un toque más tuyo. ¡Tú decides!',
    ],
    moreThemes: 'Algunos temas más',
    discountLead: `¡Queremos Halloween! Aquí tienes un código de ${THEMES_LAUNCH_DISCOUNT_PERCENT}% de descuento para hacer tu Lotería de miedo antes del 31 de octubre:`,
    expires: `Este código es de un solo uso y vence en ${THEMES_LAUNCH_EXPIRY_DAYS} días.`,
    cta: `Elige un tema con ${THEMES_LAUNCH_DISCOUNT_PERCENT}% de descuento`,
    footer: 'Recibes esto porque te registraste en Lotería Generator.',
    unsubscribe: 'Cancelar suscripción',
  },
};

export function themesLaunchSubject(locale: 'en' | 'es'): string {
  return locale === 'es'
    ? 'Nuevo en Lotería Generator: temas personalizados'
    : 'New in Lotería Generator: Custom Themes';
}

const captionStyle = {
  color: EMAIL_COLORS.muted,
  fontSize: '13px',
  lineHeight: '18px',
  textAlign: 'center' as const,
  margin: '8px 0 0',
} as const;

const subheadingStyle = {
  color: EMAIL_COLORS.brown,
  fontSize: '16px',
  fontWeight: 'bold',
  margin: '24px 0 8px',
} as const;

const featureStyle = {
  ...paragraphStyle,
  margin: '0 0 8px',
} as const;

export function ThemesLaunchEmail({
  name,
  locale,
  discountCode,
  redeemUrl,
  unsubscribeUrl,
  appUrl,
}: ThemesLaunchEmailProps) {
  const t = COPY[locale] ?? COPY.en;
  return (
    <LoteriaEmailLayout
      locale={locale}
      preview={t.preview}
      appUrl={appUrl}
      unsubscribeUrl={unsubscribeUrl}
      footerText={t.footer}
      unsubscribeLabel={t.unsubscribe}
    >
      <Heading style={headingStyle}>
        {t.heading[0]}
        <br />
        {t.heading[1]}
      </Heading>
      <Text style={paragraphStyle}>{t.greeting(firstName(name))}</Text>
      {t.body.map((paragraph) => (
        <Text key={paragraph} style={paragraphStyle}>
          {paragraph}
        </Text>
      ))}

      <Section style={{ margin: '16px 0 0' }}>
        <Img
          src={`${appUrl}/email/themes-halloween-board.jpg`}
          alt={t.heroAlt}
          width="416"
          height="539"
          style={{
            width: '100%',
            maxWidth: '416px',
            height: 'auto',
            display: 'block',
            margin: '0 auto',
            borderRadius: '8px',
          }}
        />
        <Text style={captionStyle}>{t.heroCaption}</Text>
      </Section>

      <Text style={subheadingStyle}>{t.whatsNew}</Text>
      {t.features.map((feature) => (
        <Text key={feature} style={featureStyle}>
          <span style={{ color: EMAIL_COLORS.primary }}>★</span> {feature}
        </Text>
      ))}

      <Text style={subheadingStyle}>{t.moreThemes}</Text>
      <Row>
        {MORE_THEMES.map((theme, i) => (
          <Column
            key={theme.file}
            style={{
              width: '33%',
              verticalAlign: 'top',
              paddingLeft: i === 0 ? 0 : '4px',
              paddingRight: i === MORE_THEMES.length - 1 ? 0 : '4px',
            }}
          >
            <Img
              src={`${appUrl}/email/${theme.file}`}
              alt={theme[locale]}
              width="130"
              height="168"
              style={{
                width: '100%',
                maxWidth: '130px',
                height: 'auto',
                display: 'block',
                margin: '0 auto',
                borderRadius: '6px',
              }}
            />
            <Text style={captionStyle}>{theme[locale]}</Text>
          </Column>
        ))}
      </Row>

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
ThemesLaunchEmail.PreviewProps = {
  name: 'Ana',
  locale: 'en',
  discountCode: 'THEMES-7KQ2M9',
  redeemUrl: 'http://localhost:3006/redeem?code=THEMES-7KQ2M9',
  unsubscribeUrl: 'http://localhost:3006/unsubscribe?token=demo-token&lang=en',
  appUrl: 'http://localhost:3006',
} satisfies ThemesLaunchEmailProps;

export default ThemesLaunchEmail;
