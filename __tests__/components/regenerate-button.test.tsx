import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

const refresh = vi.fn();
vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh }) }));
vi.mock('@/app/actions/admin-board-realtime', () => ({
  getAdminBoardRealtimeToken: vi.fn(),
}));

// The test pushes board-channel messages by re-rendering with a new delta.
const realtime = vi.hoisted(() => ({
  delta: [] as unknown[],
  lastOptions: null as null | { enabled?: boolean; pauseOnHidden?: boolean },
}));
vi.mock('inngest/react', () => ({
  useRealtime: (options: { enabled?: boolean; pauseOnHidden?: boolean }) => {
    realtime.lastOptions = options;
    return { connectionStatus: 'open', messages: { delta: realtime.delta } };
  },
}));

import { RegenerateButton } from '@/app/(admin)/admin/components/regenerate-button';

function cardUpdated(cardId: string, status: string) {
  return { topic: 'cardUpdated', data: { cardId, status } };
}

beforeEach(() => {
  vi.clearAllMocks();
  realtime.delta = [];
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true }));
});

async function queueRegeneration() {
  const view = render(<RegenerateButton cardId="c1" boardId="b1" />);
  fireEvent.click(screen.getByRole('button', { name: /regenerate illustration/i }));
  await screen.findByRole('button', { name: /regeneration queued/i });
  return view;
}

describe('RegenerateButton', () => {
  it('refreshes the page and resets once this card finishes', async () => {
    const { rerender } = await queueRegeneration();
    realtime.delta = [cardUpdated('c1', 'processing')];
    rerender(<RegenerateButton cardId="c1" boardId="b1" />);
    expect(refresh).not.toHaveBeenCalled();

    realtime.delta = [cardUpdated('c1', 'completed')];
    rerender(<RegenerateButton cardId="c1" boardId="b1" />);
    await waitFor(() => expect(refresh).toHaveBeenCalledTimes(1));
    expect(screen.getByRole('button', { name: /regenerate illustration/i })).toBeEnabled();
  });

  it('subscribes only while a regeneration is pending, even when the tab is hidden', async () => {
    render(<RegenerateButton cardId="c1" boardId="b1" />);
    expect(realtime.lastOptions?.enabled).toBe(false);
    fireEvent.click(screen.getByRole('button', { name: /regenerate illustration/i }));
    await screen.findByRole('button', { name: /regeneration queued/i });
    expect(realtime.lastOptions?.enabled).toBe(true);
    expect(realtime.lastOptions?.pauseOnHidden).toBe(false);
  });

  it('ignores updates for other cards on the board', async () => {
    const { rerender } = await queueRegeneration();
    realtime.delta = [cardUpdated('other', 'completed')];
    rerender(<RegenerateButton cardId="c1" boardId="b1" />);
    expect(refresh).not.toHaveBeenCalled();
  });

  it('refreshes and shows the failure when regeneration errors', async () => {
    const { rerender } = await queueRegeneration();
    realtime.delta = [cardUpdated('c1', 'error')];
    rerender(<RegenerateButton cardId="c1" boardId="b1" />);
    await waitFor(() => expect(refresh).toHaveBeenCalledTimes(1));
    expect(screen.getByRole('button', { name: /failed/i })).toBeInTheDocument();
  });

  it('does not refresh for updates that arrive before anything was queued', () => {
    realtime.delta = [cardUpdated('c1', 'completed')];
    render(<RegenerateButton cardId="c1" boardId="b1" />);
    expect(refresh).not.toHaveBeenCalled();
  });
});
