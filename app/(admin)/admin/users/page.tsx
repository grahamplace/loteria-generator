import { db, user } from '@/db';
import { desc, sql } from 'drizzle-orm';
import { AdminBreadcrumb } from '../components/admin-breadcrumb';
import { UserSearch } from '../components/user-search';

async function getUsers() {
  const result = await db
    .select({
      id: user.id,
      email: user.email,
      name: user.name,
      createdAt: user.createdAt,
      boardCount: sql<number>`(select count(*) from boards where boards.user_id = "user"."id")`.as(
        'board_count'
      ),
      cardCount: sql<number>`(select count(*) from cards where cards.user_id = "user"."id")`.as(
        'card_count'
      ),
      paidBoardCount:
        sql<number>`(select count(*) from boards where boards.user_id = "user"."id" and boards.is_unlocked = true)`.as(
          'paid_board_count'
        ),
      reengagementSentAt: sql<
        string | null
      >`(select sent_at::text from lifecycle_emails le where le.user_id = "user"."id" and le.type = 'reengagement' order by sent_at desc nulls last limit 1)`.as(
        'reengagement_sent_at'
      ),
    })
    .from(user)
    .orderBy(desc(user.createdAt));

  return result.map((u) => ({
    ...u,
    boardCount: Number(u.boardCount),
    cardCount: Number(u.cardCount),
    paidBoardCount: Number(u.paidBoardCount),
    createdAt: u.createdAt.toISOString(),
    reengagementSentAt: u.reengagementSentAt,
  }));
}

export default async function AdminUsersPage() {
  const users = await getUsers();

  return (
    <div className="space-y-4">
      <AdminBreadcrumb items={[{ label: 'Users' }]} />
      <h2 className="text-lg font-semibold">Users ({users.length})</h2>
      <UserSearch users={users} />
    </div>
  );
}
