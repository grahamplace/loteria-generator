'use client';

import { useState } from 'react';
import { usePathname, useRouter } from '@/i18n/navigation';
import { Button } from '@/components/ui/button';

function setLocaleCookie(value: 'en' | 'es-MX') {
  const secure =
    typeof window !== 'undefined' && window.location.protocol === 'https:' ? '; secure' : '';
  document.cookie = `LOCALE=${value}; max-age=${60 * 60 * 24 * 365}; path=/; samesite=lax${secure}`;
}

export function LocaleBannerClient() {
  const router = useRouter();
  const pathname = usePathname();
  const [dismissed, setDismissed] = useState(false);

  if (dismissed) return null;

  return (
    <div
      role="region"
      aria-live="polite"
      className="bg-secondary/20 border-b border-secondary/40 px-4 py-3 text-sm flex items-center justify-center gap-3 flex-wrap"
    >
      <span>¿Prefieres ver esta página en español?</span>
      <Button
        size="sm"
        onClick={() => {
          setLocaleCookie('es-MX');
          router.replace(pathname, { locale: 'es-MX' });
        }}
      >
        Sí, cambiar
      </Button>
      <Button
        size="sm"
        variant="ghost"
        onClick={() => {
          setLocaleCookie('en');
          setDismissed(true);
        }}
      >
        Seguir en inglés
      </Button>
    </div>
  );
}
