import { db, boards, boardExports, cards, user } from '@/db';
import { eq, sql } from 'drizzle-orm';
import { notFound } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { AdminBreadcrumb } from '../../components/admin-breadcrumb';
import { RetryFailedButton } from '../../components/retry-failed-button';
import { AdminExportButton } from '../../components/admin-export-button';
import { AdminPreviewBoardsButton } from '../../components/admin-preview-boards-button';
import { AdminBoardCardsGrid } from '../../components/admin-board-cards-grid';
import { GenerationLimitForm } from '../../components/generation-limit-form';
import type { BoardStyleOptions } from '@/lib/generate-boards';
import Link from 'next/link';
import { getGenerationLimit } from '@/db/schema';
import { isRetriableCard } from '@/lib/admin';
import { describeBoardPayment } from '@/lib/admin-metrics';

async function getBoardWithOwner(boardId: string) {
  const result = await db
    .select({
      board: boards,
      ownerEmail: user.email,
      ownerName: user.name,
      ownerId: user.id,
    })
    .from(boards)
    .innerJoin(user, eq(boards.userId, user.id))
    .where(eq(boards.id, boardId))
    .limit(1);

  return result[0] ?? null;
}

async function getExportSummary(boardId: string) {
  const [row] = await db
    .select({
      customer: sql<number>`count(*) filter (where ${boardExports.source} <> 'admin')`,
      backfilled: sql<number>`count(*) filter (where ${boardExports.source} = 'posthog_backfill')`,
      admin: sql<number>`count(*) filter (where ${boardExports.source} = 'admin')`,
      lastCustomerExport:
        sql<Date | null>`max(${boardExports.createdAt}) filter (where ${boardExports.source} <> 'admin')`.mapWith(
          boardExports.createdAt
        ),
    })
    .from(boardExports)
    .where(eq(boardExports.boardId, boardId));

  return {
    customer: Number(row.customer),
    backfilled: Number(row.backfilled),
    admin: Number(row.admin),
    lastCustomerExport: row.lastCustomerExport,
  };
}

async function getBoardCards(boardId: string) {
  return db.select().from(cards).where(eq(cards.boardId, boardId)).orderBy(cards.number);
}

export default async function AdminBoardDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [data, boardCards, exports] = await Promise.all([
    getBoardWithOwner(id),
    getBoardCards(id),
    getExportSummary(id),
  ]);

  if (!data) {
    notFound();
  }

  const { board, ownerEmail, ownerName, ownerId } = data;
  const genLimit = getGenerationLimit(board);
  const now = new Date();
  const errorCount = boardCards.filter((c) => isRetriableCard(c, now)).length;
  const payment = describeBoardPayment(board);

  return (
    <div className="space-y-6">
      <AdminBreadcrumb
        items={[
          { label: 'Users', href: '/admin/users' },
          { label: ownerEmail, href: `/admin/users/${ownerId}` },
          { label: board.name },
        ]}
      />

      {/* Board info */}
      <Card>
        <CardHeader>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <CardTitle className="text-sm font-medium">Board Info</CardTitle>
            <div className="flex flex-wrap items-center gap-2">
              <RetryFailedButton boardId={id} errorCount={errorCount} />
              <AdminExportButton
                boardId={id}
                boardName={board.name}
                cards={boardCards}
                styleOptions={board.styleOptions as BoardStyleOptions | null}
              />
              <AdminPreviewBoardsButton
                boardName={board.name}
                cards={boardCards}
                styleOptions={board.styleOptions as BoardStyleOptions | null}
              />
              {board.isUnlocked ? (
                <Badge variant="default">Unlocked</Badge>
              ) : (
                <Badge variant="secondary">Free</Badge>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-3 text-sm sm:space-y-2">
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
            <div className="min-w-0">
              <p className="text-xs text-muted-foreground">Owner</p>
              <Link href={`/admin/users/${ownerId}`} className="block truncate hover:underline">
                {ownerEmail}
              </Link>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Cards</p>
              <p>{boardCards.length}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Generations</p>
              <p>
                {board.imageGenerationsUsed}/{genLimit}
                {board.generationLimitOverride !== null && (
                  <span className="ml-1 text-xs text-muted-foreground">(override)</span>
                )}
              </p>
              <GenerationLimitForm boardId={id} override={board.generationLimitOverride} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
            <div>
              <p className="text-xs text-muted-foreground">Created</p>
              <p>{board.createdAt.toLocaleDateString()}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Updated</p>
              <p>{board.updatedAt.toLocaleDateString()}</p>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
            <div>
              <p className="text-xs text-muted-foreground">Customer exports</p>
              <p className="tabular-nums">
                {exports.customer === 0 ? 'Never exported' : exports.customer}
                {exports.lastCustomerExport && (
                  <span className="ml-1 text-xs text-muted-foreground">
                    (last {exports.lastCustomerExport.toLocaleDateString()})
                  </span>
                )}
              </p>
              {(exports.backfilled > 0 || exports.admin > 0) && (
                <p className="text-xs text-muted-foreground">
                  {[
                    exports.backfilled > 0 && `${exports.backfilled} from PostHog history`,
                    exports.admin > 0 && `${exports.admin} by admin, not counted`,
                  ]
                    .filter(Boolean)
                    .join(' · ')}
                </p>
              )}
            </div>
            <div className="min-w-0">
              <p className="text-xs text-muted-foreground">Payment</p>
              <p>{payment ?? (board.isUnlocked ? 'Unlocked without payment' : 'Not paid')}</p>
            </div>
            {board.stripePaymentId && (
              <div className="col-span-2 min-w-0 sm:col-span-1">
                <p className="text-xs text-muted-foreground">Stripe Payment ID</p>
                <p className="break-all font-mono text-xs">{board.stripePaymentId}</p>
              </div>
            )}
          </div>
          {board.styleOptions && (
            <div>
              <p className="text-xs text-muted-foreground">Style Options</p>
              <pre className="mt-1 overflow-x-auto rounded bg-muted p-2 text-xs">
                {JSON.stringify(board.styleOptions, null, 2)}
              </pre>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Cards grid (client component with realtime subscription) */}
      <AdminBoardCardsGrid
        boardId={id}
        initialCards={boardCards}
        owner={{ id: ownerId, name: ownerName, email: ownerEmail }}
      />
    </div>
  );
}
