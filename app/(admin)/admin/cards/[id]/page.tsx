import Image from 'next/image';
import { db, cards, boards, user } from '@/db';
import { eq } from 'drizzle-orm';
import { notFound } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { AdminBreadcrumb } from '../../components/admin-breadcrumb';
import { cardImageProps, CARD_DETAIL_THUMB_WIDTH } from '@/lib/card-image';
import Link from 'next/link';
import { Grid2X2 } from 'lucide-react';
import { RegenerateButton } from '../../components/regenerate-button';
import { RecropButton } from '../../components/recrop-button';
import { ReplaceIllustrationButton } from '../../components/replace-illustration-button';

async function getCardWithContext(cardId: string) {
  const result = await db
    .select({
      card: cards,
      boardName: boards.name,
      boardId: boards.id,
      ownerEmail: user.email,
      ownerId: user.id,
    })
    .from(cards)
    .innerJoin(boards, eq(cards.boardId, boards.id))
    .innerJoin(user, eq(cards.userId, user.id))
    .where(eq(cards.id, cardId))
    .limit(1);

  return result[0] ?? null;
}

function StatusBadge({ status }: { status: string }) {
  const variant =
    status === 'completed' ? 'default' : status === 'error' ? 'destructive' : 'secondary';
  return <Badge variant={variant}>{status}</Badge>;
}

export default async function AdminCardDebugPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const data = await getCardWithContext(id);

  if (!data) {
    notFound();
  }

  const { card, boardName, boardId, ownerEmail, ownerId } = data;

  return (
    <div className="space-y-6">
      <AdminBreadcrumb
        items={[
          { label: 'Users', href: '/admin/users' },
          { label: ownerEmail, href: `/admin/users/${ownerId}` },
          { label: boardName, href: `/admin/boards/${boardId}` },
          { label: `Card #${card.number}` },
        ]}
      />

      {/* Metadata */}
      <Card>
        <CardHeader>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <CardTitle className="text-sm font-medium">
              Card #{card.number} — {card.label || 'Unlabeled'}
            </CardTitle>
            <div className="flex flex-wrap items-center gap-2">
              <Button asChild variant="outline" size="sm">
                <Link href={`/admin/boards/${boardId}`}>
                  <Grid2X2 className="h-4 w-4" />
                  View Board
                </Link>
              </Button>
              {card.originalImageUrl && (
                <RegenerateButton cardId={card.id} initialOverlay={card.promptOverlay} />
              )}
              {card.preserveOriginal && card.originalImageUrl && (
                <RecropButton
                  cardId={card.id}
                  boardId={card.boardId}
                  initialCrop={card.cropData ?? null}
                />
              )}
              {!card.isDefault && <ReplaceIllustrationButton cardId={card.id} />}
              <StatusBadge status={card.status} />
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-3 text-sm sm:space-y-2">
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            <div className="col-span-2 min-w-0 sm:col-span-1">
              <p className="text-xs text-muted-foreground">Card ID</p>
              <p className="break-all font-mono text-xs">{card.id}</p>
            </div>
            <div className="min-w-0">
              <p className="text-xs text-muted-foreground">Board</p>
              <Link href={`/admin/boards/${boardId}`} className="block truncate hover:underline">
                {boardName}
              </Link>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Created</p>
              <p>{card.createdAt.toLocaleDateString()}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Updated</p>
              <p>{card.updatedAt.toLocaleDateString()}</p>
            </div>
          </div>
          {card.status === 'error' && card.errorMessage && (
            <div className="rounded border border-destructive/30 bg-destructive/10 p-3">
              <p className="text-xs font-medium text-destructive">Error Message</p>
              <p className="mt-1 text-sm">{card.errorMessage}</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Side-by-side images */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {/* Original */}
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">Original Upload</CardTitle>
          </CardHeader>
          <CardContent>
            {card.originalImageUrl ? (
              <div className="space-y-2">
                <div className="relative aspect-[2/3] overflow-hidden rounded border border-border bg-muted">
                  <Image
                    {...cardImageProps(
                      `/api/admin/images/${card.id}/original`,
                      CARD_DETAIL_THUMB_WIDTH
                    )}
                    alt="Original upload"
                    fill
                    sizes="(max-width: 640px) 100vw, 50vw"
                    className="object-cover"
                  />
                </div>
                <p className="break-all font-mono text-[10px] text-muted-foreground">
                  {card.originalImageUrl}
                </p>
              </div>
            ) : (
              <div className="flex aspect-[2/3] items-center justify-center rounded border border-dashed border-border bg-muted">
                <p className="text-sm text-muted-foreground">No image</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Illustration */}
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-medium">AI Illustration</CardTitle>
          </CardHeader>
          <CardContent>
            {card.illustrationUrl ? (
              <div className="space-y-2">
                <div className="relative aspect-[2/3] overflow-hidden rounded border border-border bg-muted">
                  <Image
                    {...cardImageProps(
                      card.isDefault
                        ? card.illustrationUrl
                        : `/api/admin/images/${card.id}/illustration`,
                      CARD_DETAIL_THUMB_WIDTH
                    )}
                    alt="AI illustration"
                    fill
                    sizes="(max-width: 640px) 100vw, 50vw"
                    className="object-cover"
                  />
                </div>
                <p className="break-all font-mono text-[10px] text-muted-foreground">
                  {card.illustrationUrl}
                </p>
              </div>
            ) : (
              <div className="flex aspect-[2/3] items-center justify-center rounded border border-dashed border-border bg-muted">
                <p className="text-sm text-muted-foreground">No illustration</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
