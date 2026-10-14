import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  BoardDownloadControls,
  useBoardDownload,
  type BoardDownloadProps,
} from '@/components/board-download-controls';
import { generateLoteriaSetPdf } from '@/lib/generate-boards';
import { MAX_EXPORT_BOARD_COUNT } from '@/lib/constants';
import { toast } from 'sonner';
import messages from '@/messages/en.json';

vi.mock('@/lib/generate-boards', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/generate-boards')>()),
  generateLoteriaSetPdf: vi.fn(),
}));
vi.mock('posthog-js', () => ({ default: { capture: vi.fn(), captureException: vi.fn() } }));
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
const generate = vi.mocked(generateLoteriaSetPdf);
const cards = Array.from({ length: 16 }, (_, i) => ({
  id: String(i),
  number: i + 1,
  label: `Card ${i}`,
  illustration: `/card-${i}.webp`,
}));
function Controls(props: BoardDownloadProps) {
  return <BoardDownloadControls state={useBoardDownload(props)} />;
}
function view(overrides: Partial<BoardDownloadProps> = {}) {
  return (
    <NextIntlClientProvider locale="en" timeZone="UTC" messages={messages}>
      <Controls
        cards={cards.slice(0, 4)}
        boardName="Our Halloween"
        photoMode="original"
        styles={{ presetId: 'halloween', showTitle: true }}
        isUnlocked={false}
        {...overrides}
      />
    </NextIntlClientProvider>
  );
}
beforeEach(() => {
  generate.mockReset().mockResolvedValue(new Blob(['pdf']));
  vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
  URL.createObjectURL = vi.fn(() => 'blob:download');
  URL.revokeObjectURL = vi.fn();
});
afterEach(() => vi.restoreAllMocks());

describe('downloads beneath the live preview', () => {
  it('exports a themed free sample repeatedly using only ready cards', async () => {
    render(
      view({
        cards: [
          ...cards.slice(0, 4),
          { ...cards[4], isProcessing: true },
          { ...cards[5], error: 'Failed' },
        ],
      })
    );
    const button = screen.getByRole('button', { name: 'Download preview' });
    for (let i = 1; i <= 2; i++) {
      fireEvent.click(button);
      await waitFor(() => expect(button).toBeEnabled());
      expect(generate).toHaveBeenCalledTimes(i);
    }
    expect(generate).toHaveBeenLastCalledWith(
      cards.slice(0, 4),
      { presetId: 'halloween', showTitle: true },
      expect.any(Function),
      expect.any(Object),
      1,
      expect.objectContaining({ boardTitle: 'Our Halloween', sampleLabel: 'Sample' })
    );
  });
  it('preserves full-set counts and clamps the technical maximum independently of payment', async () => {
    render(view({ cards, styles: { presetId: 'classic', showTitle: false } }));
    fireEvent.change(screen.getByRole('spinbutton'), {
      target: { value: String(MAX_EXPORT_BOARD_COUNT + 1) },
    });
    const button = screen.getByRole('button', { name: 'Download set' });
    fireEvent.click(button);
    await waitFor(() => expect(button).toBeEnabled());
    expect(generate).toHaveBeenCalledWith(
      cards,
      { presetId: 'classic', showTitle: false },
      expect.any(Function),
      expect.any(Object),
      MAX_EXPORT_BOARD_COUNT,
      expect.objectContaining({ boardTitle: undefined })
    );
  });
  it('disables downloads before a card is ready', () => {
    render(view({ cards: [{ ...cards[0], isProcessing: true }] }));
    expect(screen.getByRole('button', { name: 'Download preview' })).toBeDisabled();
    expect(generate).not.toHaveBeenCalled();
  });
  it('retains the label while downloading and recovers after failure', async () => {
    let reject!: (reason: Error) => void;
    generate.mockReturnValueOnce(
      new Promise((_, fail) => {
        reject = fail;
      })
    );
    render(view());
    const button = screen.getByRole('button', { name: 'Download preview' });
    fireEvent.click(button);
    expect(button).toBeDisabled();
    expect(screen.getByRole('status')).toBeVisible();
    await act(async () => reject(new Error('Image unavailable')));
    expect(button).toBeEnabled();
    expect(toast.error).toHaveBeenCalled();
  });
});
