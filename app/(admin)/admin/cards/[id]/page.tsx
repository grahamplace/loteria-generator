import { db, cards, boards, user } from '@/db';
import { eq } from 'drizzle-orm';
import { notFound } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { AdminBreadcrumb } from '../../components/admin-breadcrumb';
import { AdminCardDetail } from '../../components/admin-card-detail';
import Link from 'next/link';
import { Grid2X2 } from 'lucide-react';

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

      {/* From lg up the card view fills the viewport below the breadcrumb. */}
      <div className="lg:h-[calc(100dvh-7rem)]">
        <AdminCardDetail
          card={card}
          board={{ id: boardId, name: boardName }}
          headerExtra={
            <Button asChild variant="outline" size="sm">
              {/* Opens this card in the board's modal, so arrow keys page from here. */}
              <Link href={`/admin/boards/${boardId}?card=${card.id}`}>
                <Grid2X2 className="h-4 w-4" />
                View Board
              </Link>
            </Button>
          }
        />
      </div>
    </div>
  );
}
