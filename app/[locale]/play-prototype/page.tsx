/**
 * PROTOTYPE ROUTE — throwaway. Ticket 08 on the live-game map.
 *
 * Three variants of the Player's phone view, switchable via `?variant=A|B|C`.
 * Fake data, no socket, no persistence. Delete once a variant wins; the full
 * set lives on the `prototype/player-board` branch as the primary source.
 *
 * Deliberate across all three: the Board never marks which cards have been
 * Called. Ticket 07 settled that paying attention is the game, so highlighting
 * called tiles would hand the Player the answer.
 */
import { setRequestLocale } from 'next-intl/server';
import { PrototypeClient } from './prototype-client';

export const metadata = { title: 'Player board prototype' };

export default async function PlayPrototypePage({
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
