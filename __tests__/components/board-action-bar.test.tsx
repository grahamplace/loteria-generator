import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';

vi.mock('next-intl', () => ({
  useTranslations: () => (key: string, params?: Record<string, unknown>) =>
    params ? `${key}:${JSON.stringify(params)}` : key,
}));
vi.mock('posthog-js', () => ({ default: { capture: vi.fn() } }));
vi.mock('sonner', () => ({ toast: Object.assign(vi.fn(), { error: vi.fn() }) }));
vi.mock('@/lib/generate-boards', () => ({
  generateLoteriaSetPdf: vi.fn(),
  clampBoardCount: (n: number) => n,
}));

import { BoardActionBar } from '@/components/board-action-bar';
import { BOARD_UNLOCK_PRICE_DISPLAY } from '@/lib/constants';

function renderBar(props: { cardCount: number; maxCards: number; isUnlocked: boolean }) {
  const onUnlockRequired = vi.fn();
  render(
    <BoardActionBar
      {...props}
      onFilesSelected={vi.fn()}
      processedCount={props.cardCount}
      processingCount={0}
      cards={[]}
      boardName="Test"
      onUnlockRequired={onUnlockRequired}
      onOpenDefaults={vi.fn()}
    />
  );
  return { onUnlockRequired };
}

const unlockLabel = `unlockMoreCards:${JSON.stringify({ price: BOARD_UNLOCK_PRICE_DISPLAY })}`;

describe('BoardActionBar mobile footer', () => {
  it('swaps Choose photos for an Unlock button at the free limit', () => {
    const { onUnlockRequired } = renderBar({ cardCount: 4, maxCards: 4, isUnlocked: false });

    expect(screen.queryByRole('button', { name: 'choosePhotos' })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: unlockLabel }));
    expect(onUnlockRequired).toHaveBeenCalledOnce();
  });

  it('keeps Choose photos below the free limit', () => {
    renderBar({ cardCount: 3, maxCards: 4, isUnlocked: false });

    expect(screen.getByRole('button', { name: 'choosePhotos' })).toBeEnabled();
    expect(screen.queryByRole('button', { name: unlockLabel })).not.toBeInTheDocument();
  });

  it('shows a disabled Choose photos, not Unlock, on a full unlocked board', () => {
    renderBar({ cardCount: 54, maxCards: 54, isUnlocked: true });

    expect(screen.getByRole('button', { name: 'choosePhotos' })).toBeDisabled();
    expect(screen.queryByRole('button', { name: unlockLabel })).not.toBeInTheDocument();
  });

  it('no longer shows a Saved indicator', () => {
    renderBar({ cardCount: 3, maxCards: 4, isUnlocked: false });

    expect(screen.queryByText('mobileSaved')).not.toBeInTheDocument();
  });
});
