import Image from 'next/image';
import Link from 'next/link';
import { and, count, desc, eq, isNotNull } from 'drizzle-orm';
import { db, cards, boards, user } from '@/db';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { AdminBreadcrumb } from '../components/admin-breadcrumb';

const PAGE_SIZE = 20;

const customCardsFilter = and(
  eq(cards.isDefault, false),
  isNotNull(cards.originalImageUrl),
  isNotNull(cards.illustrationUrl)
);

async function getCardsPage(page: number) {
  const [rows, [{ total }]] = await Promise.all([
    db
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
      .where(customCardsFilter)
      .orderBy(desc(cards.createdAt))
      .limit(PAGE_SIZE)
      .offset((page - 1) * PAGE_SIZE),
    db.select({ total: count() }).from(cards).where(customCardsFilter),
  ]);

  return { rows, total };
}

function StatusBadge({ status }: { status: string }) {
  const variant =
    status === 'completed' ? 'default' : status === 'error' ? 'destructive' : 'secondary';
  return <Badge variant={variant}>{status}</Badge>;
}

export default async function AdminCardsPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  const { page: pageParam } = await searchParams;
  const requestedPage = Math.max(1, Number(pageParam) || 1);

  const { rows, total } = await getCardsPage(requestedPage);
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const page = Math.min(requestedPage, totalPages);

  const start = total === 0 ? 0 : (page - 1) * PAGE_SIZE + 1;
  const end = Math.min(page * PAGE_SIZE, total);

  return (
    <div className="space-y-4">
      <AdminBreadcrumb items={[{ label: 'Cards' }]} />
      <div className="space-y-1">
        <h2 className="text-lg font-semibold">Cards ({total})</h2>
        <p className="text-sm text-muted-foreground">
          Custom cards, newest first, showing the original upload next to the AI illustration.
          Default loteria cards are excluded.
        </p>
      </div>

      {rows.length === 0 ? (
        <div className="flex items-center justify-center rounded border border-dashed border-border bg-muted p-12">
          <p className="text-sm text-muted-foreground">No custom cards yet.</p>
        </div>
      ) : (
        <>
          <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
            {rows.map((card) => (
              <li key={card.id}>
                <Link
                  href={`/admin/cards/${card.id}`}
                  className="block rounded-lg border border-border bg-card p-2 transition-colors hover:border-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <div className="grid grid-cols-2 gap-1.5">
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

                  <div className="mt-2 flex items-center justify-between gap-2">
                    <div className="min-w-0">
                      <p className="truncate text-xs font-medium">
                        #{card.number} — {card.label || 'Unlabeled'}
                      </p>
                      <p className="truncate text-[11px] text-muted-foreground">
                        {card.ownerEmail}
                      </p>
                    </div>
                    <StatusBadge status={card.status} />
                  </div>
                </Link>
              </li>
            ))}
          </ul>

          <nav
            className="flex items-center justify-between gap-4 pt-2"
            aria-label="Cards pagination"
          >
            <p className="text-sm text-muted-foreground" aria-live="polite">
              {start}–{end} of {total}
            </p>
            <div className="flex items-center gap-2">
              {page <= 1 ? (
                <Button variant="outline" size="sm" disabled>
                  Previous
                </Button>
              ) : (
                <Button asChild variant="outline" size="sm">
                  <Link href={`/admin/cards?page=${page - 1}`} rel="prev">
                    Previous
                  </Link>
                </Button>
              )}
              <span className="text-sm tabular-nums text-muted-foreground">
                Page {page} of {totalPages}
              </span>
              {page >= totalPages ? (
                <Button variant="outline" size="sm" disabled>
                  Next
                </Button>
              ) : (
                <Button asChild variant="outline" size="sm">
                  <Link href={`/admin/cards?page=${page + 1}`} rel="next">
                    Next
                  </Link>
                </Button>
              )}
            </div>
          </nav>
        </>
      )}
    </div>
  );
}
