import { db, user } from '@/db';
import { desc, sql } from 'drizzle-orm';
import { AdminBreadcrumb } from '../components/admin-breadcrumb';
import { UserSearch } from '../components/user-search';
import { campaignTemplateOptions } from '@/lib/email/campaigns/registry';
import type { SentEmail } from '../components/sent-emails-cell';

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
      // Every lifecycle email this user has received, newest first. The admin
      // table used to get only a bare array of types, which could not say when
      // an email went out or whether it actually sent.
      sentEmails: sql<SentEmail[]>`(
        select coalesce(
          json_agg(
            json_build_object('type', le.type, 'status', le.status, 'sentAt', le.sent_at)
            order by coalesce(le.sent_at, le.created_at) desc
          ),
          '[]'::json
        )
        from lifecycle_emails le where le.user_id = "user"."id"
      )`.as('sent_emails'),
    })
    .from(user)
    .orderBy(desc(user.createdAt));

  return result.map((u) => ({
    ...u,
    boardCount: Number(u.boardCount),
    cardCount: Number(u.cardCount),
    paidBoardCount: Number(u.paidBoardCount),
    createdAt: u.createdAt.toISOString(),
    sentEmails: Array.isArray(u.sentEmails) ? u.sentEmails : [],
  }));
}

export default async function AdminUsersPage() {
  const users = await getUsers();

  return (
    <div className="space-y-4">
      <AdminBreadcrumb items={[{ label: 'Users' }]} />
      <h2 className="text-lg font-semibold">Users ({users.length})</h2>
      <UserSearch users={users} templateOptions={campaignTemplateOptions()} />
    </div>
  );
}
