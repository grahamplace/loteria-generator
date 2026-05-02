import Image from 'next/image';
import Link from 'next/link';
import { getTranslations } from 'next-intl/server';

export async function LandingFooter() {
  const t = await getTranslations('Marketing.Footer');
  return (
    <footer className="border-t border-[var(--color-rule-warm)] py-14">
      <div className="mx-auto max-w-[1240px] px-6 sm:px-8">
        <div className="flex flex-wrap items-center justify-between gap-6">
          <div className="flex items-center gap-2.5">
            <Image src="/loteria-star.png" alt="" width={32} height={32} className="h-8 w-8" />
            <span className="font-display text-[19px] font-bold tracking-tight text-foreground">
              Lotería Generator
            </span>
          </div>
          <div className="flex flex-wrap gap-6">
            <Link href="/sign-up" className="text-sm text-muted-foreground hover:text-foreground">
              {t('getStarted')}
            </Link>
            <Link href="/sign-in" className="text-sm text-muted-foreground hover:text-foreground">
              {t('signIn')}
            </Link>
            <Link href="/faq" className="text-sm text-muted-foreground hover:text-foreground">
              {t('faq')}
            </Link>
            <Link href="/#pricing" className="text-sm text-muted-foreground hover:text-foreground">
              {t('pricing')}
            </Link>
          </div>
          <p className="font-jetbrains text-[12px] tracking-wider text-muted-foreground">
            © {new Date().getFullYear()} — {t('tagline')}
          </p>
        </div>
      </div>
    </footer>
  );
}
