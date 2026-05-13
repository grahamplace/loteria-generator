import { db, user, boards, cards } from '@/db';
import { count, eq, desc, sql } from 'drizzle-orm';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import Link from 'next/link';

async function getStats() {
  const [[userCount], [boardCount], [unlockedCount], [cardCount], [errorCount]] = await Promise.all(
    [
      db.select({ count: count() }).from(user),
      db.select({ count: count() }).from(boards),
      db.select({ count: count() }).from(boards).where(eq(boards.isUnlocked, true)),
      db.select({ count: count() }).from(cards),
      db.select({ count: count() }).from(cards).where(eq(cards.status, 'error')),
    ]
  );

  return {
    users: userCount.count,
    boards: boardCount.count,
    unlockedBoards: unlockedCount.count,
    cards: cardCount.count,
    errors: errorCount.count,
  };
}

async function getRecentErrors() {
  return db
    .select({
      cardId: cards.id,
      cardNumber: cards.number,
      errorMessage: cards.errorMessage,
      cardCreatedAt: cards.createdAt,
      boardId: boards.id,
      boardName: boards.name,
      userEmail: user.email,
    })
    .from(cards)
    .innerJoin(boards, eq(cards.boardId, boards.id))
    .innerJoin(user, eq(cards.userId, user.id))
    .where(eq(cards.status, 'error'))
    .orderBy(desc(cards.updatedAt))
    .limit(10);
}

async function getRecentSignups() {
  const result = await db
    .select({
      id: user.id,
      email: user.email,
      name: user.name,
      createdAt: user.createdAt,
      boardCount: sql<number>`(select count(*) from boards where boards.user_id = "user"."id")`.as(
        'board_count'
      ),
    })
    .from(user)
    .orderBy(desc(user.createdAt))
    .limit(10);

  return result.map((u) => ({ ...u, boardCount: Number(u.boardCount) }));
}

export default async function AdminOverview() {
  const [stats, recentErrors, recentSignups] = await Promise.all([
    getStats(),
    getRecentErrors(),
    getRecentSignups(),
  ]);

  return (
    <div className="space-y-6">
      <h2 className="text-lg font-semibold">Overview</h2>

      {/* Stats cards */}
      <div className="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Users</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{stats.users}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Boards</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{stats.boards}</p>
            <p className="text-xs text-muted-foreground">{stats.unlockedBoards} unlocked</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Cards</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{stats.cards}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Errors</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-destructive">{stats.errors}</p>
          </CardContent>
        </Card>
      </div>

      {/* Recent errors */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium">Recent Errors</CardTitle>
        </CardHeader>
        <CardContent>
          {recentErrors.length === 0 ? (
            <p className="text-sm text-muted-foreground">No errors</p>
          ) : (
            <div className="-mx-6 overflow-x-auto px-6">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>User</TableHead>
                    <TableHead>Board</TableHead>
                    <TableHead>Card</TableHead>
                    <TableHead>Error</TableHead>
                    <TableHead>Time</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {recentErrors.map((error) => (
                    <TableRow key={error.cardId}>
                      <TableCell className="whitespace-nowrap text-xs">{error.userEmail}</TableCell>
                      <TableCell className="whitespace-nowrap">
                        <Link
                          href={`/admin/boards/${error.boardId}`}
                          className="text-xs hover:underline"
                        >
                          {error.boardName}
                        </Link>
                      </TableCell>
                      <TableCell>
                        <Link
                          href={`/admin/cards/${error.cardId}`}
                          className="text-xs hover:underline"
                        >
                          #{error.cardNumber}
                        </Link>
                      </TableCell>
                      <TableCell className="max-w-xs truncate text-xs text-destructive">
                        {error.errorMessage || 'Unknown error'}
                      </TableCell>
                      <TableCell className="whitespace-nowrap text-xs text-muted-foreground">
                        {error.cardCreatedAt.toLocaleDateString()}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Recent signups */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium">Recent Signups</CardTitle>
        </CardHeader>
        <CardContent>
          {recentSignups.length === 0 ? (
            <p className="text-sm text-muted-foreground">No users yet</p>
          ) : (
            <div className="-mx-6 overflow-x-auto px-6">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Email</TableHead>
                    <TableHead>Name</TableHead>
                    <TableHead>Boards</TableHead>
                    <TableHead>Joined</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {recentSignups.map((u) => (
                    <TableRow key={u.id}>
                      <TableCell className="whitespace-nowrap">
                        <Link href={`/admin/users/${u.id}`} className="text-xs hover:underline">
                          {u.email}
                        </Link>
                      </TableCell>
                      <TableCell className="whitespace-nowrap text-xs">{u.name}</TableCell>
                      <TableCell className="text-xs tabular-nums">{u.boardCount}</TableCell>
                      <TableCell className="whitespace-nowrap text-xs text-muted-foreground">
                        {u.createdAt.toLocaleDateString()}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
