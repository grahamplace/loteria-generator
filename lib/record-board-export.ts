/**
 * Report a finished PDF export so it shows up in admin metrics. Fire-and-forget:
 * the PDF is already downloaded, so a failed report must never surface as a
 * failed export.
 */
export function recordBoardExport(
  boardId: string,
  details: { boardCount: number; cardCount: number }
): void {
  fetch(`/api/boards/${boardId}/exports`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(details),
    keepalive: true,
  }).catch((error) => {
    console.error('Failed to record export:', error);
  });
}
