'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { joinGame, type JoinGameResult } from '@/app/actions/live-game';
import { getDeviceToken } from '@/components/live-game/device-token';
import { PlayerBoard } from '@/components/live-game/player-board';
import { GAME_CODE_LENGTH } from '@/lib/constants';

type Joined = Extract<JoinGameResult, { ok: true }>;

export function JoinForm({ initialCode }: { initialCode: string }) {
  const t = useTranslations('LiveGame.join');
  const [code, setCode] = useState(initialCode);
  const [nickname, setNickname] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [joined, setJoined] = useState<Joined | null>(null);

  if (joined) return <PlayerBoard joined={joined} />;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    // The token is generated here rather than server-side so the same device
    // returning to this Code gets its seat back without an account.
    const result = await joinGame(code.trim(), nickname, getDeviceToken(code.trim()));
    setBusy(false);
    if (result.ok) setJoined(result);
    else setError(t(`errors.${result.reason}`));
  };

  return (
    <main className="mx-auto flex min-h-dvh max-w-sm flex-col justify-center gap-6 p-6">
      <h1 className="text-3xl font-bold text-foreground">{t('title')}</h1>
      <form onSubmit={submit} className="flex flex-col gap-4" noValidate>
        <label className="flex flex-col gap-1.5">
          <span className="text-sm font-medium text-foreground">{t('codeLabel')}</span>
          <input
            value={code}
            onChange={(e) => setCode(e.target.value)}
            // Numeric keypad on phones; digits are why the Code is digits.
            inputMode="numeric"
            autoComplete="one-time-code"
            spellCheck={false}
            maxLength={GAME_CODE_LENGTH}
            placeholder={t('codePlaceholder')}
            className="h-14 rounded-xl border border-border bg-card px-4 text-center text-2xl tracking-[0.3em] tabular-nums"
          />
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="text-sm font-medium text-foreground">{t('nicknameLabel')}</span>
          <input
            value={nickname}
            onChange={(e) => setNickname(e.target.value)}
            autoComplete="nickname"
            spellCheck={false}
            maxLength={16}
            placeholder={t('nicknamePlaceholder')}
            className="h-14 rounded-xl border border-border bg-card px-4 text-lg"
          />
        </label>

        {/* Errors are specific and carry a next step; a bare "not found" is the
            survey's documented worst case. */}
        {error && (
          <p
            aria-live="polite"
            className="rounded-lg bg-secondary px-3 py-2 text-sm text-secondary-foreground"
          >
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={busy}
          style={{ touchAction: 'manipulation' }}
          className="h-14 rounded-xl bg-primary text-lg font-bold text-primary-foreground disabled:opacity-60"
        >
          {busy ? t('joining') : t('submit')}
        </button>
      </form>
    </main>
  );
}
