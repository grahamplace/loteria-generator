import { db, boards, user } from '@/db';
import { desc, eq, sql, gt } from 'drizzle-orm';
import { AdminBreadcrumb } from '../components/admin-breadcrumb';
import { AdminBulkUpload } from '../components/admin-bulk-upload';
import { BoardList } from '../components/board-list';
import { describeBoardPayment } from '@/lib/admin-metrics';

async function getBoards() {
  const cardCount =
    sql<number>`(select count(*) from cards where cards.board_id = "boards"."id")`.as('card_count');

  const result = await db
    .select({
      id: boards.id,
      name: boards.name,
      styleOptions: boards.styleOptions,
      isUnlocked: boards.isUnlocked,
      imageGenerationsUsed: boards.imageGenerationsUsed,
      generationLimitOverride: boards.generationLimitOverride,
      updatedAt: boards.updatedAt,
      ownerEmail: user.email,
      ownerId: user.id,
      cardCount,
      exportCount: sql<number>`(select count(*) from board_exports e where e.board_id = "boards"."id" and e.source <> 'admin')`,
      stripePaymentId: boards.stripePaymentId,
      amountPaidCents: boards.amountPaidCents,
      amountDiscountCents: boards.amountDiscountCents,
      amountRefundedCents: boards.amountRefundedCents,
      currency: boards.currency,
      promotionCode: boards.promotionCode,
    })
    .from(boards)
    .innerJoin(user, eq(boards.userId, user.id))
    .where(gt(sql<number>`(select count(*) from cards where cards.board_id = "boards"."id")`, 0))
    .orderBy(desc(boards.updatedAt));

  return result.map((b) => ({
    id: b.id,
    name: b.name,
    styleOptions: b.styleOptions,
    isUnlocked: b.isUnlocked,
    imageGenerationsUsed: b.imageGenerationsUsed,
    generationLimitOverride: b.generationLimitOverride,
    ownerEmail: b.ownerEmail,
    ownerId: b.ownerId,
    cardCount: Number(b.cardCount),
    exportCount: Number(b.exportCount),
    payment: describeBoardPayment(b),
    updatedAt: b.updatedAt.toISOString(),
  }));
}

export default async function AdminBoardsPage() {
  const boardList = await getBoards();

  return (
    <div className="space-y-4">
      <AdminBreadcrumb items={[{ label: 'Boards' }]} />
      <AdminBulkUpload />
      <h2 className="text-lg font-semibold">Boards ({boardList.length})</h2>
      <BoardList boards={boardList} />
    </div>
  );
}
