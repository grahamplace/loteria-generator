'use client';

/**
 * "Play live" on the Set page — the only way into a Game from the UI.
 *
 * Deliberately not a one-tap button: the Pattern is fixed for the whole Game
 * (ticket 07), so it has to be chosen before the first card is drawn rather
 * than changed halfway through.
 */
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { Play } from 'lucide-react';
import { createGame } from '@/app/actions/live-game';
import { GAME_PATTERNS } from '@/lib/live-game/patterns';
import type { GamePattern } from '@/db/schema';
import { MIN_GAME_CARD_COUNT, SMALL_SET_ADVISORY_CARD_COUNT } from '@/lib/constants';

export function StartGameButton({
  setId,
  completedCardCount,
}: {
  setId: string;
  completedCardCount: number;
}) {
  const t = useTranslations('LiveGame.start');
  const tp = useTranslations('LiveGame.patterns');
  // Hoisted: this sits inside a conditionally rendered dialog, and a hook
  // called from there runs only sometimes.
  const tc = useTranslations('LiveGame.caller');
  const router = useRouter();

  const [open, setOpen] = useState(false);
  const [pattern, setPattern] = useState<GamePattern>('any_row');
  const [seconds, setSeconds] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Hidden rather than disabled: a Set that cannot host a Game has no Play
  // button to explain away. The dialog explains it if they get here another way.
  const eligible = completedCardCount >= MIN_GAME_CARD_COUNT;
  if (!eligible) return null;

  const start = async () => {
    setBusy(true);
    setError(null);
    const result = await createGame(setId, pattern, seconds);
    setBusy(false);
    if (result.ok) {
      router.push(`/games/${result.code}`);
      return;
    }
    setError(
      result.reason === 'game_already_running'
        ? t('errors.game_already_running', { code: result.existingCode ?? '' })
        : result.reason === 'too_few_cards'
          ? t('errors.too_few_cards', { count: result.cardCount ?? 0 })
          : t(`errors.${result.reason}`)
    );
  };

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="flex h-8 items-center gap-1.5 rounded-lg bg-accent px-3 text-xs font-semibold text-accent-foreground shadow-sm transition-colors hover:bg-accent/90 focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:outline-none"
      >
        <Play className="h-3.5 w-3.5" />
        <span className="hidden md:inline">{t('button')}</span>
      </button>

      {open && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={t('title')}
          className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4"
          onClick={(e) => e.target === e.currentTarget && setOpen(false)}
        >
          <div className="w-full max-w-sm rounded-2xl border border-border bg-card p-5 shadow-xl">
            <h2 className="text-xl font-bold text-foreground">{t('title')}</h2>

            {completedCardCount < SMALL_SET_ADVISORY_CARD_COUNT && (
              <p className="mt-3 rounded-lg bg-secondary px-3 py-2 text-sm text-secondary-foreground">
                {t('smallSetAdvisory', { count: completedCardCount })}
              </p>
            )}

            <label className="mt-4 flex flex-col gap-1.5">
              <span className="text-sm font-medium text-foreground">{t('patternLabel')}</span>
              <select
                value={pattern}
                onChange={(e) => setPattern(e.target.value as GamePattern)}
                className="h-11 rounded-lg border border-border bg-background px-3 text-foreground"
              >
                {GAME_PATTERNS.map((p) => (
                  <option key={p} value={p}>
                    {tp(p as never)}
                  </option>
                ))}
              </select>
            </label>

            <label className="mt-3 flex flex-col gap-1.5">
              <span className="text-sm font-medium text-foreground">{t('paceLabel')}</span>
              <select
                value={seconds ?? 'manual'}
                onChange={(e) =>
                  setSeconds(e.target.value === 'manual' ? null : Number(e.target.value))
                }
                className="h-11 rounded-lg border border-border bg-background px-3 text-foreground"
              >
                <option value="manual">{tc('manual')}</option>
                {[4, 6, 8].map((s) => (
                  <option key={s} value={s}>
                    {s}s
                  </option>
                ))}
              </select>
            </label>

            {error && (
              <p
                aria-live="polite"
                className="mt-3 rounded-lg bg-secondary px-3 py-2 text-sm text-secondary-foreground"
              >
                {error}
              </p>
            )}

            <button
              onClick={start}
              disabled={busy}
              className="mt-5 h-12 w-full rounded-xl bg-primary text-base font-bold text-primary-foreground disabled:opacity-60"
            >
              {busy ? t('starting') : t('start')}
            </button>
          </div>
        </div>
      )}
    </>
  );
}
