import { setRequestLocale } from 'next-intl/server';
import { JoinForm } from '../join-form';

/**
 * The deep link. Always shared unprefixed (`/play/482913`), so next-intl's
 * locale detection lands each Player in their own language rather than forcing
 * the Caller's on everyone they invite.
 */
export default async function PlayCodePage({
  params,
}: {
  params: Promise<{ locale: string; code: string }>;
}) {
  const { locale, code } = await params;
  setRequestLocale(locale);
  return <JoinForm initialCode={code} />;
}
