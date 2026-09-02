/**
 * PROTOTYPE ROUTE — throwaway. Ticket 09 on the live-game map.
 *
 * Three variants of the Caller's screen, switchable via `?variant=A|B|C`, each
 * walkable through all three Game phases via the dropdown in the switcher bar.
 * Fake data, no socket, no persistence.
 *
 * All three assume the Caller does NOT hold a Board and cannot Claim — ticket 06
 * files dealer-is-a-player under Feels bad. That is the open fog item this
 * ticket has to settle, so push back if you disagree.
 */
import { setRequestLocale } from 'next-intl/server';
import { PrototypeClient } from './prototype-client';

export const metadata = { title: 'Caller view prototype' };

export default async function CallPrototypePage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ variant?: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const { variant } = await searchParams;
  return <PrototypeClient variant={variant ?? 'A'} />;
}
