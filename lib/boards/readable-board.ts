import { and, eq, isNull } from 'drizzle-orm';
import { boards } from '@/db';
import { isAdminEmail } from '@/lib/admin';

type Viewer = { id: string; email?: string | null };

/**
 * Who may read a board: its owner, or the admin ("View as customer" in the
 * admin portal). Writes stay owner-only; use this for GET paths alone.
 */
export function readableBoardWhere(boardId: string, viewer: Viewer) {
  return and(
    eq(boards.id, boardId),
    isNull(boards.deletedAt),
    isAdminEmail(viewer.email) ? undefined : eq(boards.userId, viewer.id)
  );
}
