'use client';
import { useEffect, useRef, useState } from 'react';
import { useRouter } from '@/i18n/navigation';
import { useTranslations, useLocale } from 'next-intl';
import { getTheme, type ThemeId, type PhotoMode } from '@/lib/themes/presets';
import { presetBoardStyle } from '@/lib/themes/render-style';
import { Button } from '@/components/ui/button';
import posthog from 'posthog-js';

export function ThemeEntry({
  theme,
  photoMode,
  boards,
  starterId,
}: {
  theme: ThemeId;
  photoMode: PhotoMode;
  boards: { id: string; name: string; cardCount: number }[];
  starterId?: string;
}) {
  const t = useTranslations('Themes.Entry');
  const locale = useLocale() === 'es-MX' ? 'es-MX' : 'en';
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const started = useRef(false);
  const name = `${getTheme(theme).name[locale]} Lotería`;
  async function apply(id?: string) {
    setBusy(true);
    setError('');
    try {
      const response = await fetch(id ? `/api/boards/${id}` : '/api/boards', {
        method: id ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...(id && id !== starterId ? {} : { name }),
          styleOptions: { ...presetBoardStyle(theme), presetId: theme, showTitle: true },
          photoMode,
        }),
      });
      if (!response.ok) throw new Error('Could not prepare set');
      const { board } = await response.json();
      posthog.capture('theme_set_started', {
        theme,
        photo_mode: photoMode,
        locale,
        board_id: board.id,
      });
      router.replace(`/boards/${board.id}`);
    } catch {
      setError(t('error'));
      setBusy(false);
    }
  }
  useEffect(() => {
    if (starterId && !started.current) {
      started.current = true;
      void apply(starterId);
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <main className="mx-auto max-w-2xl px-5 py-16">
      <h1 className="font-display text-4xl font-bold">
        {t('title', { name: getTheme(theme).name[locale] })}
      </h1>
      {starterId ? (
        <p role="status" className="mt-5">
          {error || t('working')}
        </p>
      ) : (
        <>
          <p className="mt-4 text-muted-foreground">{t('intro')}</p>
          <Button className="mt-6" disabled={busy} onClick={() => void apply()}>
            {busy ? t('working') : t('create')}
          </Button>
          <ul className="mt-8 space-y-3">
            {boards.map((board) => (
              <li
                key={board.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border p-4"
              >
                <span className="min-w-0 break-words font-medium">{board.name}</span>
                <Button variant="outline" disabled={busy} onClick={() => void apply(board.id)}>
                  {t('apply')}
                </Button>
              </li>
            ))}
          </ul>
        </>
      )}
      {error && (
        <div role="alert" className="mt-4">
          <p>{error}</p>
          {starterId && <Button onClick={() => void apply(starterId)}>{t('retry')}</Button>}
        </div>
      )}
    </main>
  );
}
