// emails/components/layout.tsx
//
// Shared chrome for lifecycle emails: the cream backdrop, centered wordmark,
// white content card, optional "how it works" example image, and the footer
// with the unsubscribe link. The wordmark, example image, and (in marketing
// email) a "visit the site" line all link to the dashboard, so a reader who
// skips the main button still has several ways back into the app. Each email supplies its own copy as children and
// (optionally) the DiscountCallout.
import * as React from 'react';
import {
  Html,
  Head,
  Preview,
  Body,
  Container,
  Section,
  Text,
  Button,
  Hr,
  Link,
  Img,
} from '@react-email/components';

export const EMAIL_COLORS = {
  primary: '#C8442C',
  gold: '#E2A53C',
  cream: '#FAF5E6',
  brown: '#3D2B1F',
  card: '#FFFFFF',
  muted: '#8a7a6a',
} as const;

// Shared text styles so each email's body copy stays visually consistent.
export const headingStyle = {
  color: EMAIL_COLORS.primary,
  fontSize: '24px',
  margin: '0 0 16px',
} as const;

export const paragraphStyle = {
  color: EMAIL_COLORS.brown,
  fontSize: '16px',
  lineHeight: '24px',
} as const;

export const leadStyle = {
  ...paragraphStyle,
  marginTop: '16px',
} as const;

/** The dashboard in the reader's language; Spanish lives under `/es`. */
export function dashboardUrl(appUrl: string, locale: 'en' | 'es'): string {
  return `${appUrl}${locale === 'es' ? '/es' : ''}/dashboard`;
}

const VISIT_SITE_COPY = {
  en: (host: string) => `Visit ${host} →`,
  es: (host: string) => `Visita ${host} →`,
};

export type LoteriaEmailLayoutProps = {
  locale: 'en' | 'es';
  /** Inbox preview snippet. */
  preview: string;
  /** Absolute base URL (e.g. https://…) used to build public asset URLs. */
  appUrl: string;
  /** Omit for transactional email, which must not offer an unsubscribe link. */
  unsubscribeUrl?: string;
  footerText: string;
  unsubscribeLabel?: string;
  /** Render the "how it works" example image at the bottom of the card. */
  showExampleImage?: boolean;
  children: React.ReactNode;
};

export function LoteriaEmailLayout({
  locale,
  preview,
  appUrl,
  unsubscribeUrl,
  footerText,
  unsubscribeLabel,
  showExampleImage = false,
  children,
}: LoteriaEmailLayoutProps) {
  const logoSrc = `${appUrl}/email/wordmark.png`;
  const exampleSrc = `${appUrl}/email/loteria-process.png`;
  const dashboardHref = dashboardUrl(appUrl, locale);
  const host = new URL(appUrl).host;
  return (
    <Html lang={locale}>
      <Head />
      <Preview>{preview}</Preview>
      <Body
        style={{ backgroundColor: EMAIL_COLORS.cream, margin: 0, fontFamily: 'Georgia, serif' }}
      >
        <Container style={{ maxWidth: '480px', margin: '0 auto', padding: '32px 24px' }}>
          <Link href={dashboardHref}>
            <Img
              src={logoSrc}
              alt="Lotería Generator"
              width="240"
              height="40"
              style={{
                width: '240px',
                maxWidth: '100%',
                height: 'auto',
                display: 'block',
                margin: '0 auto 24px',
              }}
            />
          </Link>
          <Section
            style={{
              backgroundColor: EMAIL_COLORS.card,
              borderRadius: '16px',
              border: `1px solid ${EMAIL_COLORS.gold}`,
              padding: '32px',
            }}
          >
            {children}
            {showExampleImage && (
              <Link href={dashboardHref}>
                <Img
                  src={exampleSrc}
                  alt="How it works: your photos become custom Lotería cards"
                  width="416"
                  height="539"
                  style={{
                    width: '100%',
                    maxWidth: '416px',
                    height: 'auto',
                    display: 'block',
                    margin: '24px auto 0',
                  }}
                />
              </Link>
            )}
            {/* Marketing only: a password reset should carry just the one link. */}
            {unsubscribeUrl && (
              <Text style={{ textAlign: 'center' as const, fontSize: '15px', margin: '20px 0 0' }}>
                <Link
                  href={dashboardHref}
                  style={{ color: EMAIL_COLORS.primary, textDecoration: 'underline' }}
                >
                  {(VISIT_SITE_COPY[locale] ?? VISIT_SITE_COPY.en)(host)}
                </Link>
              </Text>
            )}
            <Hr style={{ borderColor: EMAIL_COLORS.gold, margin: '24px 0' }} />
            <Text style={{ color: EMAIL_COLORS.muted, fontSize: '12px', lineHeight: '18px' }}>
              {footerText}
              {unsubscribeUrl && (
                <>
                  {' '}
                  <Link
                    href={unsubscribeUrl}
                    style={{ color: EMAIL_COLORS.muted, textDecoration: 'underline' }}
                  >
                    {unsubscribeLabel}
                  </Link>
                </>
              )}
            </Text>
          </Section>
        </Container>
      </Body>
    </Html>
  );
}

/** The one primary action in an email: full-width, brand red. */
export const ctaButtonStyle = {
  backgroundColor: EMAIL_COLORS.primary,
  color: '#ffffff',
  borderRadius: '12px',
  padding: '14px 24px',
  fontSize: '16px',
  fontWeight: 'bold',
  textDecoration: 'none',
  display: 'block',
  textAlign: 'center' as const,
} as const;

export function CtaButton({ href, label }: { href: string; label: string }) {
  return (
    <Button href={href} style={ctaButtonStyle}>
      {label}
    </Button>
  );
}

export type DiscountCalloutProps = {
  discountCode: string;
  redeemUrl: string;
  cta: string;
  expires: string;
};

/** Dashed promo-code box, redeem CTA button, and the expiry fine print. */
export function DiscountCallout({ discountCode, redeemUrl, cta, expires }: DiscountCalloutProps) {
  return (
    <>
      <Section
        style={{
          backgroundColor: EMAIL_COLORS.cream,
          border: `2px dashed ${EMAIL_COLORS.primary}`,
          borderRadius: '12px',
          padding: '16px',
          textAlign: 'center' as const,
          margin: '8px 0 16px',
        }}
      >
        <Text
          style={{
            color: EMAIL_COLORS.primary,
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
      <CtaButton href={redeemUrl} label={cta} />
      <Text
        style={{
          color: EMAIL_COLORS.brown,
          fontSize: '13px',
          textAlign: 'center' as const,
          marginTop: '12px',
        }}
      >
        {expires}
      </Text>
    </>
  );
}
