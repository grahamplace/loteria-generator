/** A navigation preference only; /start verifies this board belongs to the session. */
export const RECENT_BOARD_COOKIE = 'loteria-recent-board';

export function rememberBoard(boardId: string) {
  document.cookie = `${RECENT_BOARD_COOKIE}=${encodeURIComponent(boardId)}; Path=/; Max-Age=31536000; SameSite=Lax${location.protocol === 'https:' ? '; Secure' : ''}`;
}
