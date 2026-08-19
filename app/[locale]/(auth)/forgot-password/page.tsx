'use client';

import { useState } from 'react';
import Link from 'next/link';
import posthog from 'posthog-js';
import { useLocale, useTranslations } from 'next-intl';
import { authClient } from '@/lib/auth-client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { LanguageSwitch } from '@/components/language-switch';

export default function ForgotPasswordPage() {
  const t = useTranslations('Auth.ForgotPassword');
  const locale = useLocale();
  const [email, setEmail] = useState('');
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setIsLoading(true);
    setError('');

    const trimmed = email.trim();
    // The page the emailed link lands on. The locale lives in this path and is
    // the only signal the server has for which language to send.
    const redirectTo = locale === 'en' ? '/reset-password' : '/es/reset-password';

    try {
      const result = await authClient.requestPasswordReset({ email: trimmed, redirectTo });
      if (result.error) {
        // better-auth answers identically for known and unknown addresses, so a
        // real error here means rate limiting or a transport failure — never
        // "no such user". Do not add a branch that reveals account existence.
        setError(
          result.error.status === 429 ? t('errors.rateLimited') : t('errors.unexpectedError')
        );
        return;
      }
      posthog.capture('password_reset_requested');
      setSentTo(trimmed);
    } catch {
      setError(t('errors.unexpectedError'));
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div className="relative min-h-screen flex items-center justify-center bg-gradient-to-b from-orange-50 to-white p-4">
      <div className="absolute top-4 right-4 z-10">
        <LanguageSwitch />
      </div>
      <Card className="w-full max-w-md">
        {sentTo ? (
          <>
            <CardHeader className="text-center">
              <CardTitle className="text-2xl font-bold">{t('sentTitle')}</CardTitle>
              <CardDescription className="break-words">
                {t('sentBody', { email: sentTo })}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground text-center">{t('sentHint')}</p>
            </CardContent>
          </>
        ) : (
          <>
            <CardHeader className="text-center">
              <CardTitle className="text-2xl font-bold">{t('cardTitle')}</CardTitle>
              <CardDescription>{t('cardDescription')}</CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="email">{t('emailLabel')}</Label>
                  <Input
                    id="email"
                    name="email"
                    type="email"
                    inputMode="email"
                    autoComplete="email"
                    spellCheck={false}
                    autoFocus
                    placeholder={t('emailPlaceholder')}
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    disabled={isLoading}
                  />
                </div>

                {error && (
                  <p
                    role="alert"
                    aria-live="polite"
                    className="text-sm text-destructive text-center"
                  >
                    {error}
                  </p>
                )}

                <Button type="submit" className="w-full" disabled={isLoading}>
                  {isLoading ? t('submitButtonLoading') : t('submitButton')}
                </Button>
              </form>
            </CardContent>
          </>
        )}
        <CardFooter className="flex justify-center">
          <Link href="/sign-in" className="text-sm text-primary hover:underline font-medium">
            {t('backToSignIn')}
          </Link>
        </CardFooter>
      </Card>
    </div>
  );
}
