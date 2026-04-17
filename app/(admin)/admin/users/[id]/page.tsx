import { db, user, boards, account } from '@/db';
import { eq, desc, sql } from 'drizzle-orm';
import { notFound } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { AdminBreadcrumb } from '../../components/admin-breadcrumb';
import Link from 'next/link';
import { IMAGE_GENERATION_LIMIT_FREE, IMAGE_GENERATION_LIMIT_PAID } from '@/db/schema';

async function getUser(id: string) {
  const result = await db.query.user.findFirst({
    where: eq(user.id, id),
  });
  return result ?? null;
}

async function getUserAccounts(userId: string) {
  return db
    .select({ providerId: account.providerId })
    .from(account)
    .where(eq(account.userId, userId));
}

async function getUserBoards(userId: string) {
  const result = await db
    .select({
      id: boards.id,
      name: boards.name,
      isUnlocked: boards.isUnlocked,
      stripePaymentId: boards.stripePaymentId,
      imageGenerationsUsed: boards.imageGenerationsUsed,
      createdAt: boards.createdAt,
      updatedAt: boards.updatedAt,
      cardCount: sql<number>`(select count(*) from cards where cards.board_id = "boards"."id")`.as(
        'card_count'
      ),
    })
    .from(boards)
    .where(eq(boards.userId, userId))
    .orderBy(desc(boards.updatedAt));

  return result.map((b) => ({ ...b, cardCount: Number(b.cardCount) }));
}

export default async function AdminUserDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [userData, accounts, userBoards] = await Promise.all([
    getUser(id),
    getUserAccounts(id),
    getUserBoards(id),
  ]);

  if (!userData) {
    notFound();
  }

  const providers = accounts.map((a) => a.providerId);

  return (
    <div className="space-y-6">
      <AdminBreadcrumb
        items={[{ label: 'Users', href: '/admin/users' }, { label: userData.email }]}
      />

      {/* User info header */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium">User Info</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          <div className="flex items-center gap-3">
            {userData.image && (
              <img src={userData.image} alt="" className="h-10 w-10 rounded-full" />
            )}
            <div>
              <p className="font-medium">{userData.name}</p>
              <p className="text-muted-foreground">{userData.email}</p>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-4 pt-2">
            <div>
              <p className="text-xs text-muted-foreground">Joined</p>
              <p>{userData.createdAt.toLocaleDateString()}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Auth Providers</p>
              <div className="flex gap-1">
                {providers.map((p) => (
                  <Badge key={p} variant="secondary">
                    {p}
                  </Badge>
                ))}
              </div>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">User ID</p>
              <p className="font-mono text-xs">{userData.id}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Boards list */}
      <div>
        <h3 className="mb-3 text-sm font-semibold">Boards ({userBoards.length})</h3>
        {userBoards.length === 0 ? (
          <p className="text-sm text-muted-foreground">No boards</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Cards</TableHead>
                <TableHead>Generations</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Updated</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {userBoards.map((board) => {
                const genLimit = board.isUnlocked
                  ? IMAGE_GENERATION_LIMIT_PAID
                  : IMAGE_GENERATION_LIMIT_FREE;
                return (
                  <TableRow key={board.id}>
                    <TableCell>
                      <Link href={`/admin/boards/${board.id}`} className="text-sm hover:underline">
                        {board.name}
                      </Link>
                    </TableCell>
                    <TableCell className="text-sm">{board.cardCount}</TableCell>
                    <TableCell className="text-sm">
                      {board.imageGenerationsUsed}/{genLimit}
                    </TableCell>
                    <TableCell>
                      {board.isUnlocked ? (
                        <Badge variant="default">Unlocked</Badge>
                      ) : (
                        <Badge variant="secondary">Free</Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {board.updatedAt.toLocaleDateString()}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </div>
    </div>
  );
}
