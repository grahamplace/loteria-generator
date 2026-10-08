import type { Metadata } from 'next';
import type { CSSProperties } from 'react';
import Image from 'next/image';
import { notFound } from 'next/navigation';
import { getTranslations, setRequestLocale } from 'next-intl/server';
import { Link } from '@/i18n/navigation';
import { getThemePage, themePages, themeMode, themePath, themeTitle } from '@/lib/themes/catalog';
import { themeVariables } from '@/lib/themes/presets';
import { SITE_URL } from '@/lib/site-metadata';
import { BOARD_UNLOCK_PRICE_DISPLAY, FREE_CARD_LIMIT, TOTAL_CARD_COUNT } from '@/lib/constants';
import { ThemeCta, ThemeVisit } from '@/components/theme-cta';

type Props = { params: Promise<{ locale: string; theme: string }> };
export function generateStaticParams() {
  return themePages.map((page) => ({ theme: page.id }));
}
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale, theme } = await params;
  const page = getThemePage(theme);
  if (!page) notFound();
  const copy = page[locale === 'es-MX' ? 'es-MX' : 'en'];
  const title = themeTitle(page, locale);
  const description = copy.intro.split('. ').slice(0, 2).join('. ');
  const path = themePath(theme, locale);
  const image = {
    url: `/themes/${theme}/og-${locale === 'es-MX' ? 'es' : 'en'}.jpg`,
    width: 1200,
    height: 630,
    alt: title,
  };
  return {
    title,
    description,
    alternates: {
      canonical: path,
      languages: {
        en: themePath(theme),
        'es-MX': themePath(theme, 'es-MX'),
        'x-default': themePath(theme),
      },
    },
    openGraph: {
      title,
      description,
      url: `${SITE_URL}${path}`,
      type: 'website',
      locale: locale === 'es-MX' ? 'es_MX' : 'en_US',
      images: [image],
    },
    twitter: { card: 'summary_large_image', title, description, images: [image] },
  };
}
export default async function ThemeLandingPage({ params }: Props) {
  const { locale, theme } = await params;
  setRequestLocale(locale);
  const page = getThemePage(theme);
  if (!page) notFound();
  const language = locale === 'es-MX' ? 'es-MX' : 'en';
  const copy = page[language];
  const t = await getTranslations('Themes.Page');
  const title = themeTitle(page, locale);
  const cta = (
    <ThemeCta theme={page.id} mode={themeMode(theme)}>
      {t('create', { name: copy.name })}
    </ThemeCta>
  );
  const relatedIds: Record<string, string[]> = {
    halloween: ['friendsgiving', 'christmas', 'new-years'],
    wedding: ['bridal-shower', 'destination-wedding', 'anniversary'],
    'original-photos': ['family-reunion', 'milestone-birthday', 'birthday'],
    classroom: ['graduation', 'soccer-team', 'birthday'],
    hanukkah: ['family-reunion', 'new-years', 'original-photos'],
    'destination-wedding': ['wedding', 'bachelorette', 'anniversary'],
    'baby-shower': ['birthday', 'family-reunion', 'original-photos'],
    quinceanera: ['birthday', 'family-reunion', 'graduation'],
  };
  const related = (
    relatedIds[theme] ?? ['birthday', 'family-reunion', 'original-photos', 'wedding']
  )
    .filter((id) => id !== theme)
    .slice(0, 3)
    .map((id) => getThemePage(id)!);
  const breadcrumb = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      {
        '@type': 'ListItem',
        position: 1,
        name: t('home'),
        item: `${SITE_URL}${locale === 'es-MX' ? '/es' : '/'}`,
      },
      {
        '@type': 'ListItem',
        position: 2,
        name: t('hubTitle'),
        item: `${SITE_URL}${locale === 'es-MX' ? '/es' : ''}/loteria`,
      },
      {
        '@type': 'ListItem',
        position: 3,
        name: title,
        item: `${SITE_URL}${themePath(theme, locale)}`,
      },
    ],
  };
  return (
    <article id="theme-content" style={themeVariables(page.id) as CSSProperties}>
      <ThemeVisit theme={page.id} mode={themeMode(theme)} />

      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumb).replace(/</g, '\\u003c') }}
      />
      <div className="theme-surface overflow-hidden border-b border-border">
        <div className="mx-auto max-w-[1240px] px-6 py-6 sm:px-8">
          <nav aria-label="Breadcrumb" className="text-sm">
            <Link href="/loteria" className="underline underline-offset-4">
              {t('browse')}
            </Link>
            <span aria-hidden="true"> / </span>
            {copy.name}
          </nav>
          <div className="grid items-center gap-10 py-10 md:grid-cols-[1.05fr_1fr] md:py-16">
            <div>
              <p className="font-mono text-xs tracking-[0.15em] uppercase">{t('eyebrow')}</p>
              <h1 className="theme-heading mt-6 text-[clamp(42px,6vw,78px)] leading-[1.02] tracking-tight text-balance">
                {title}
              </h1>
              <p className="mt-6 max-w-xl text-lg leading-relaxed">{copy.intro}</p>
              <p className="mt-6 font-semibold text-lg">{t('custom')}</p>
              <div className="mt-6">{cta}</div>
              <p className="mt-4 text-sm">{t('freeNote', { free: FREE_CARD_LIMIT })}</p>
              <p className="mt-1 text-sm">
                {t('priceNote', { price: BOARD_UNLOCK_PRICE_DISPLAY, total: TOTAL_CARD_COUNT })}
              </p>
            </div>
            <div className="relative mx-auto w-full max-w-[420px] py-6">
              <div aria-hidden="true" className="theme-rule absolute inset-3 rotate-6 border-2" />
              <Image
                src={`/themes/${theme}/board-1.webp`}
                alt={`${title} — ${t('custom')}`}
                width={1000}
                height={1294}
                sizes="(max-width: 768px) 85vw, 420px"
                preload
                className="relative h-auto w-full -rotate-2 shadow-xl"
              />
            </div>
          </div>
        </div>
      </div>
      <section className="mx-auto grid max-w-[1120px] gap-10 px-6 py-16 md:grid-cols-2 md:items-center md:py-24">
        <div className="grid grid-cols-2 gap-4 items-center">
          <figure>
            <Image
              src={`/themes/${theme}/photo.webp`}
              alt={`${copy.name}: ${t('photoAlt')}`}
              width={640}
              height={960}
              sizes="(max-width: 768px) 42vw, 250px"
              className="h-auto w-full rounded-sm"
            />
            <figcaption className="mt-3 text-center font-mono text-xs uppercase tracking-widest">
              {t('before')}
            </figcaption>
          </figure>
          <figure>
            <Image
              src={`/themes/${theme}/card.webp`}
              alt={`${copy.name}: ${t('cardAlt')}`}
              width={604}
              height={904}
              sizes="(max-width: 768px) 42vw, 250px"
              className="h-auto w-full rotate-3 shadow-lg"
            />
            <figcaption className="mt-3 text-center font-mono text-xs uppercase tracking-widest">
              {t('after')}
            </figcaption>
          </figure>
        </div>
        <div>
          <h2 className="font-display text-4xl font-bold tracking-tight">
            {t(theme === 'original-photos' ? 'originalHeading' : 'photoHeading')}
          </h2>
          <p className="mt-5 text-lg leading-relaxed text-muted-foreground">{t('photoBody')}</p>
          <p className="mt-4 leading-relaxed">{t('themeIncluded')}</p>
        </div>
      </section>
      <section className="border-y border-border bg-card">
        <div className="mx-auto max-w-[1120px] px-6 py-16">
          <h2 className="font-display text-3xl font-bold">{t('ideasHeading')}</h2>
          <ul className="mt-8 grid gap-x-10 gap-y-5 sm:grid-cols-2 lg:grid-cols-3">
            {copy.ideas.map((idea, index) => (
              <li key={idea} className="flex gap-4 border-b border-border pb-4">
                <span className="font-mono text-sm text-primary">
                  {String(index + 1).padStart(2, '0')}
                </span>
                <span className="text-lg">{idea}</span>
              </li>
            ))}
          </ul>
          <div className="mt-12 max-w-3xl">
            <h2 className="font-display text-3xl font-bold">{t('playHeading')}</h2>
            <p className="mt-5 text-lg leading-relaxed text-muted-foreground">{copy.play}</p>
          </div>
        </div>
      </section>
      <section className="mx-auto max-w-[1120px] px-6 py-16">
        <h2 className="font-display text-3xl font-bold">{t('stepsHeading')}</h2>
        <ol className="mt-8 grid gap-8 md:grid-cols-3">
          {(t.raw('steps') as string[]).map((step, index) => (
            <li key={step}>
              <span className="font-display text-5xl font-bold text-primary">0{index + 1}</span>
              <p className="mt-4 leading-relaxed">{step}</p>
            </li>
          ))}
        </ol>
      </section>
      <section className="mx-auto max-w-3xl px-6 py-10">
        <h2 className="font-display text-3xl font-bold">{t('questions')}</h2>
        {(['Theme', 'Free', 'Print'] as const).map((key) => (
          <details key={key} className="border-b border-border py-5">
            <summary className="cursor-pointer py-2 font-semibold focus-visible:outline-2 focus-visible:outline-primary">
              {t(`question${key}`)}
            </summary>
            <p className="mt-3 leading-relaxed text-muted-foreground">
              {t(`answer${key}`, {
                free: FREE_CARD_LIMIT,
                price: BOARD_UNLOCK_PRICE_DISPLAY,
                total: TOTAL_CARD_COUNT,
              })}
            </p>
          </details>
        ))}
        <div className="py-10">{cta}</div>
      </section>
      <section className="mx-auto max-w-[1120px] px-6 pb-20">
        <h2 className="font-display text-3xl font-bold">{t('related')}</h2>
        <div className="mt-8 grid gap-5 sm:grid-cols-3">
          {related.map((item) => (
            <Link
              href={`/loteria/${item.id}`}
              key={item.id}
              className="rounded-lg border border-border p-5 text-lg font-semibold text-primary hover:bg-primary/5"
            >
              {themeTitle(item, locale)} <span aria-hidden="true">→</span>
            </Link>
          ))}
        </div>
      </section>
    </article>
  );
}
