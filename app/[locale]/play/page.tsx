import { setRequestLocale } from 'next-intl/server';
import { JoinForm } from './join-form';

/**
 * Typed entry. The deep link `/play/482913` pre-fills the Code and skips
 * straight to the nickname, and the QR on the Caller's screen encodes that.
 *
 * No account: a Player is a device token and a nickname.
 */
export default async function PlayPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  setRequestLocale(locale);
  return <JoinForm initialCode="" />;
}
