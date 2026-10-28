/**
 * True when the client's card list and the server's disagree on which cards
 * exist (e.g. a missed realtime `split` added or removed cards). Optimistic
 * `temp-` cards are not on the server yet, so they are ignored.
 */
export function needsFullReload(localIds: string[], serverIds: string[]): boolean {
  const local = new Set(localIds.filter((id) => !id.startsWith('temp-')));
  const server = new Set(serverIds);
  if (local.size !== server.size) return true;
  for (const id of server) if (!local.has(id)) return true;
  return false;
}
