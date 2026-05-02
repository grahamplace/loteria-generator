'use client';

import { Globe } from 'lucide-react';
import { useLocale } from 'next-intl';
import { usePathname, useRouter } from '@/i18n/navigation';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

const OPTIONS = [
  { value: 'en' as const, label: 'English' },
  { value: 'es' as const, label: 'Español' },
];

export function LanguageSwitch() {
  const locale = useLocale();
  const router = useRouter();
  const pathname = usePathname();

  function setLocale(next: 'en' | 'es') {
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
        <Button variant="ghost" size="sm" aria-label="Change language" className="gap-1.5">
          <Globe className="h-4 w-4" />
          <span className="text-xs font-medium uppercase">{locale}</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {OPTIONS.map((opt) => (
          <DropdownMenuItem
            key={opt.value}
            data-active={opt.value === locale ? 'true' : 'false'}
            onClick={() => setLocale(opt.value)}
          >
            {opt.label}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
