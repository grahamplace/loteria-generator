import Image from 'next/image';
import Link from 'next/link';
import { and, desc, eq, isNotNull } from 'drizzle-orm';
import { db, cards, boards, user } from '@/db';
import { Badge } from '@/components/ui/badge';
import { AdminBreadcrumb } from '../components/admin-breadcrumb';

const RECENT_LIMIT = 60;

async function getRecentCards() {
  return db
    .select({
      id: cards.id,
      number: cards.number,
      label: cards.label,
      status: cards.status,
      createdAt: cards.createdAt,
      boardName: boards.name,
      ownerEmail: user.email,
    })
    .from(cards)
    .innerJoin(boards, eq(cards.boardId, boards.id))
    .innerJoin(user, eq(cards.userId, user.id))
    .where(
      and(
        eq(cards.isDefault, false),
        isNotNull(cards.originalImageUrl),
        isNotNull(cards.illustrationUrl)
      )
    )
    .orderBy(desc(cards.createdAt))
    .limit(RECENT_LIMIT);
}

function StatusBadge({ status }: { status: string }) {
  const variant =
    status === 'completed' ? 'default' : status === 'error' ? 'destructive' : 'secondary';
  return <Badge variant={variant}>{status}</Badge>;
}

export default async function AdminCardsPage() {
  const recentCards = await getRecentCards();

  return (
    <div className="space-y-4">
      <AdminBreadcrumb items={[{ label: 'Cards' }]} />
      <div className="space-y-1">
        <h2 className="text-lg font-semibold">Recent Cards ({recentCards.length})</h2>
        <p className="text-sm text-muted-foreground">
          The {RECENT_LIMIT} most recently created custom cards, showing the original upload next to
          the AI illustration. Default loteria cards are excluded.
        </p>
      </div>

      {recentCards.length === 0 ? (
        <div className="flex items-center justify-center rounded border border-dashed border-border bg-muted p-12">
          <p className="text-sm text-muted-foreground">No custom cards yet.</p>
        </div>
      ) : (
        <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {recentCards.map((card) => (
            <li key={card.id}>
              <Link
                href={`/admin/cards/${card.id}`}
                className="block rounded-lg border border-border bg-card p-3 transition-colors hover:border-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-1">
                    <div className="relative aspect-[2/3] overflow-hidden rounded border border-border bg-muted">
                      <Image
                        src={`/api/admin/images/${card.id}/original`}
                        alt={`Original upload for card #${card.number}`}
                        fill
                        unoptimized
                        className="object-cover"
                      />
                    </div>
                    <p className="text-center text-[10px] uppercase tracking-wide text-muted-foreground">
                      Original
                    </p>
                  </div>
                  <div className="space-y-1">
                    <div className="relative aspect-[2/3] overflow-hidden rounded border border-border bg-muted">
                      <Image
                        src={`/api/admin/images/${card.id}/illustration`}
                        alt={`AI illustration for card #${card.number}`}
                        fill
                        unoptimized
                        className="object-cover"
                      />
                    </div>
                    <p className="text-center text-[10px] uppercase tracking-wide text-muted-foreground">
                      Illustration
                    </p>
                  </div>
                </div>

                <div className="mt-3 flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">
                      #{card.number} — {card.label || 'Unlabeled'}
                    </p>
                    <p className="truncate text-xs text-muted-foreground">{card.ownerEmail}</p>
                  </div>
                  <StatusBadge status={card.status} />
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
