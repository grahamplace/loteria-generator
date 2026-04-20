import Image from 'next/image';
import { db, boards, cards, user } from '@/db';
import { eq } from 'drizzle-orm';
import { notFound } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { AdminBreadcrumb } from '../../components/admin-breadcrumb';
import Link from 'next/link';
import { IMAGE_GENERATION_LIMIT_FREE, IMAGE_GENERATION_LIMIT_PAID } from '@/db/schema';

async function getBoardWithOwner(boardId: string) {
  const result = await db
    .select({
      board: boards,
      ownerEmail: user.email,
      ownerId: user.id,
    })
    .from(boards)
    .innerJoin(user, eq(boards.userId, user.id))
    .where(eq(boards.id, boardId))
    .limit(1);

  return result[0] ?? null;
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
  const [data, boardCards] = await Promise.all([getBoardWithOwner(id), getBoardCards(id)]);

  if (!data) {
    notFound();
  }

  const { board, ownerEmail, ownerId } = data;
  const genLimit = board.isUnlocked ? IMAGE_GENERATION_LIMIT_PAID : IMAGE_GENERATION_LIMIT_FREE;

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
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm font-medium">Board Info</CardTitle>
            {board.isUnlocked ? (
              <Badge variant="default">Unlocked</Badge>
            ) : (
              <Badge variant="secondary">Free</Badge>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          <div className="grid grid-cols-3 gap-4">
            <div>
              <p className="text-xs text-muted-foreground">Owner</p>
              <Link href={`/admin/users/${ownerId}`} className="hover:underline">
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
              </p>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-4">
            <div>
              <p className="text-xs text-muted-foreground">Created</p>
              <p>{board.createdAt.toLocaleDateString()}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Updated</p>
              <p>{board.updatedAt.toLocaleDateString()}</p>
            </div>
            {board.stripePaymentId && (
              <div>
                <p className="text-xs text-muted-foreground">Stripe Payment ID</p>
                <p className="font-mono text-xs">{board.stripePaymentId}</p>
              </div>
            )}
          </div>
          {board.styleOptions && (
            <div>
              <p className="text-xs text-muted-foreground">Style Options</p>
              <pre className="mt-1 rounded bg-muted p-2 text-xs">
                {JSON.stringify(board.styleOptions, null, 2)}
              </pre>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Cards grid */}
      <div>
        <h3 className="mb-3 text-sm font-semibold">Cards ({boardCards.length})</h3>
        {boardCards.length === 0 ? (
          <p className="text-sm text-muted-foreground">No cards</p>
        ) : (
          <div className="grid grid-cols-4 gap-3 sm:grid-cols-6 lg:grid-cols-8">
            {boardCards.map((card) => (
              <Link
                key={card.id}
                href={`/admin/cards/${card.id}`}
                className="group rounded-lg border border-border p-2 transition-colors hover:border-primary"
              >
                <div className="relative mb-2 aspect-[2/3] overflow-hidden rounded bg-muted">
                  {card.illustrationUrl || card.originalImageUrl ? (
                    <Image
                      src={`/api/admin/images/${card.id}/${card.illustrationUrl ? 'illustration' : 'original'}`}
                      alt={card.label || `Card ${card.number}`}
                      fill
                      unoptimized
                      className="object-cover"
                    />
                  ) : (
                    <div className="flex h-full items-center justify-center text-xs text-muted-foreground">
                      No image
                    </div>
                  )}
                  {card.status === 'error' && (
                    <div className="absolute inset-0 flex items-center justify-center bg-destructive/20">
                      <Badge variant="destructive" className="text-[10px]">
                        Error
                      </Badge>
                    </div>
                  )}
                </div>
                <div className="text-center">
                  <p className="text-xs font-medium">#{card.number}</p>
                  <p className="truncate text-[10px] text-muted-foreground">
                    {card.label || 'Unlabeled'}
                  </p>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
