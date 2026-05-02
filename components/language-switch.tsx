'use client';

import { useLocale, useTranslations } from 'next-intl';
import { usePathname, useRouter } from '@/i18n/navigation';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

type LocaleValue = 'en' | 'es-MX';

const OPTIONS: { value: LocaleValue; label: string; flag: string }[] = [
  { value: 'en', label: 'English', flag: '🇺🇸' },
  { value: 'es-MX', label: 'Español', flag: '🇲🇽' },
];

const FLAG_BY_LOCALE: Record<LocaleValue, string> = {
  en: '🇺🇸',
  'es-MX': '🇲🇽',
};

export function LanguageSwitch() {
  const locale = useLocale();
  const router = useRouter();
  const pathname = usePathname();
  const t = useTranslations('Common.Buttons');

  const activeFlag = FLAG_BY_LOCALE[locale as LocaleValue] ?? FLAG_BY_LOCALE.en;

  function setLocale(next: LocaleValue) {
    if (next === locale) return;
    document.cookie = `LOCALE=${next}; max-age=${60 * 60 * 24 * 365}; path=/; samesite=lax${
      typeof window !== 'undefined' && window.location.protocol === 'https:' ? '; secure' : ''
    }`;
    fetch('/api/account/locale', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ locale: next }),
    }).catch(() => {
      // Silent — cookie is authoritative; unauthenticated users are expected.
    });
    router.replace(pathname, { locale: next });
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="sm" aria-label={t('changeLanguage')} className="gap-1.5">
          <span aria-hidden="true" className="text-base leading-none">
            {activeFlag}
          </span>
          <span className="text-xs font-medium uppercase">{locale.slice(0, 2)}</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {OPTIONS.map((opt) => (
          <DropdownMenuItem
            key={opt.value}
            data-active={opt.value === locale ? 'true' : 'false'}
            onClick={() => setLocale(opt.value)}
            className="gap-2"
          >
            <span aria-hidden="true" className="text-base leading-none">
              {opt.flag}
            </span>
            <span>{opt.label}</span>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
