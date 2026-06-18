import { db, boards, user } from '@/db';
import { desc, eq, sql, gt } from 'drizzle-orm';
import { AdminBreadcrumb } from '../components/admin-breadcrumb';
import { AdminBulkUpload } from '../components/admin-bulk-upload';
import { BoardList } from '../components/board-list';

async function getBoards() {
  const cardCount =
    sql<number>`(select count(*) from cards where cards.board_id = "boards"."id")`.as('card_count');

  const result = await db
    .select({
      id: boards.id,
      name: boards.name,
      isUnlocked: boards.isUnlocked,
      imageGenerationsUsed: boards.imageGenerationsUsed,
      updatedAt: boards.updatedAt,
      ownerEmail: user.email,
      ownerId: user.id,
      cardCount,
    })
    .from(boards)
    .innerJoin(user, eq(boards.userId, user.id))
    .where(gt(sql<number>`(select count(*) from cards where cards.board_id = "boards"."id")`, 0))
    .orderBy(desc(boards.updatedAt));

  return result.map((b) => ({
    ...b,
    cardCount: Number(b.cardCount),
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
