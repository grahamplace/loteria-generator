'use client';

import { Suspense, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
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
import { MIN_PASSWORD_LENGTH } from '@/lib/constants';

function ResetPasswordForm() {
  const t = useTranslations('Auth.ResetPassword');
  const locale = useLocale();
  const router = useRouter();
  const searchParams = useSearchParams();
  const passwordRef = useRef<HTMLInputElement>(null);
  const confirmRef = useRef<HTMLInputElement>(null);
  const expiredHeadingRef = useRef<HTMLDivElement>(null);

  // Captured once on mount rather than read fresh from useSearchParams() on
  // every render: the token gets scrubbed out of the visible URL below (so it
  // never rides along on a PostHog pageview capture), and the component must
  // keep working from this snapshot afterwards instead of falling back to the
  // expired state just because the URL no longer has it.
  const [token] = useState(() => searchParams.get('token'));
  const [callbackError] = useState(() => searchParams.get('error'));

  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [fieldError, setFieldError] = useState<{
    field: 'password' | 'confirm';
    message: string;
  } | null>(null);
  const [formError, setFormError] = useState('');
  // Set when the server rejects the token, which turns the page into the
  // expired state without a round trip through the URL.
  const [tokenRejected, setTokenRejected] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const signInHref = locale === 'en' ? '/sign-in' : '/es/sign-in';
  const isDead = !token || !!callbackError || tokenRejected;

  // A live reset token sitting in the URL rides along on every PostHog
  // pageview capture (posthog-js's 2026-01-30 defaults track history changes)
  // and on the password_reset_completed capture below, handing anyone with
  // PostHog read access a working reset token. Strip it from the address bar
  // once it's safely in state above. Using history.replaceState directly
  // (rather than router.replace) avoids a Next.js navigation/re-render that
  // could otherwise disturb this component's state.
  useEffect(() => {
    if (token) {
      window.history.replaceState(null, '', window.location.pathname);
    }
  }, [token]);

  // Move focus to the expired-state heading when the form is replaced, so
  // screen-reader users get an announcement that something happened.
  useEffect(() => {
    if (isDead) {
      expiredHeadingRef.current?.focus();
    }
  }, [isDead]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setFieldError(null);
    setFormError('');

    if (password.length < MIN_PASSWORD_LENGTH) {
      setFieldError({ field: 'password', message: t('errors.tooShort') });
      passwordRef.current?.focus();
      return;
    }
    if (password !== confirm) {
      setFieldError({ field: 'confirm', message: t('errors.mismatch') });
      confirmRef.current?.focus();
      return;
    }

    setIsLoading(true);
    try {
      const result = await authClient.resetPassword({ newPassword: password, token: token! });
      if (result.error) {
        const code = result.error.code ?? '';
        if (code.includes('TOKEN')) {
          setTokenRejected(true);
        } else {
          setFormError(result.error.message || t('errors.unexpectedError'));
        }
        return;
      }
      posthog.capture('password_reset_completed');
      // revokeSessionsOnPasswordReset only deletes the session row — better-auth
      // never clears the browser's session cookie the way sign-out does, and the
      // 5-minute cookieCache means a still-cookied browser can look signed in
      // for a few minutes after this. Explicitly sign out so /sign-in actually
      // reaches sign-in instead of proxy.ts bouncing it to /dashboard. The
      // session row is already gone, so this call may itself error — that's
      // fine, it must never block the redirect.
      try {
        await authClient.signOut();
      } catch {
        // Ignored — see comment above.
      }
      router.push(`${signInHref}?reset=success`);
    } catch {
      setFormError(t('errors.unexpectedError'));
    } finally {
      setIsLoading(false);
    }
  }

  if (isDead) {
    return (
      <Card className="w-full max-w-md">
        <CardHeader className="text-center" role="status" aria-live="polite">
          <CardTitle className="text-2xl font-bold" tabIndex={-1} ref={expiredHeadingRef}>
            {t('expiredTitle')}
          </CardTitle>
          <CardDescription>{t('expiredBody')}</CardDescription>
        </CardHeader>
        <CardContent>
          <Button asChild className="w-full">
            <Link href={locale === 'en' ? '/forgot-password' : '/es/forgot-password'}>
              {t('requestNewLink')}
            </Link>
          </Button>
        </CardContent>
        <CardFooter className="flex justify-center">
          <Link href={signInHref} className="text-sm text-primary hover:underline font-medium">
            {t('backToSignIn')}
          </Link>
        </CardFooter>
      </Card>
    );
  }

  return (
    <Card className="w-full max-w-md">
      <CardHeader className="text-center">
        <CardTitle className="text-2xl font-bold">{t('cardTitle')}</CardTitle>
        <CardDescription>{t('cardDescription')}</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4" noValidate>
          <div className="space-y-2">
            <Label htmlFor="password">{t('passwordLabel')}</Label>
            <Input
              id="password"
              name="new-password"
              type="password"
              autoComplete="new-password"
              autoFocus
              placeholder={t('passwordPlaceholder')}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              ref={passwordRef}
              aria-invalid={fieldError?.field === 'password'}
              aria-describedby={fieldError?.field === 'password' ? 'password-error' : undefined}
              disabled={isLoading}
              maxLength={128}
            />
            {fieldError?.field === 'password' && (
              <p id="password-error" role="alert" className="text-sm text-destructive">
                {fieldError.message}
              </p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="confirmPassword">{t('confirmLabel')}</Label>
            <Input
              id="confirmPassword"
              name="confirm-password"
              type="password"
              autoComplete="new-password"
              placeholder={t('confirmPlaceholder')}
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              ref={confirmRef}
              aria-invalid={fieldError?.field === 'confirm'}
              aria-describedby={fieldError?.field === 'confirm' ? 'confirm-error' : undefined}
              disabled={isLoading}
              maxLength={128}
            />
            {fieldError?.field === 'confirm' && (
              <p id="confirm-error" role="alert" className="text-sm text-destructive">
                {fieldError.message}
              </p>
            )}
          </div>

          {formError && (
            <p role="alert" aria-live="polite" className="text-sm text-destructive text-center">
              {formError}
            </p>
          )}

          <Button type="submit" className="w-full" disabled={isLoading}>
            {isLoading ? t('submitButtonLoading') : t('submitButton')}
          </Button>
        </form>
      </CardContent>
      <CardFooter className="flex justify-center">
        <Link href={signInHref} className="text-sm text-primary hover:underline font-medium">
          {t('backToSignIn')}
        </Link>
      </CardFooter>
    </Card>
  );
}

export default function ResetPasswordPage() {
  return (
    <div className="relative min-h-screen flex items-center justify-center bg-gradient-to-b from-orange-50 to-white p-4">
      <div className="absolute top-4 right-4 z-10">
        <LanguageSwitch />
      </div>
      <Suspense fallback={<Card className="w-full max-w-md min-h-[320px]" />}>
        <ResetPasswordForm />
      </Suspense>
    </div>
  );
}
