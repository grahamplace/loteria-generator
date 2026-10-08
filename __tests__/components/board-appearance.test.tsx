import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useSyncExternalStore, type ComponentProps } from 'react';
import { BoardAppearance } from '@/components/board-appearance';
import { renderBoardToCanvas } from '@/lib/generate-boards';
import messages from '@/messages/en.json';
import { installPrintPalettes } from '../helpers/print-palettes';

vi.mock('@/lib/generate-boards', () => ({ renderBoardToCanvas: vi.fn() }));
vi.mock('next/navigation', () => ({
  useSearchParams: () => {
    const search = useSyncExternalStore(
      (notify) => {
        window.addEventListener('popstate', notify);
        return () => window.removeEventListener('popstate', notify);
      },
      () => window.location.search
    );
    return new URLSearchParams(search);
  },
}));
const renderBoard = vi.mocked(renderBoardToCanvas);
const previewName = 'Your board rendered with the selected theme';

function canvas(value: string) {
  const output = document.createElement('canvas');
  output.toDataURL = () => `data:image/png;base64,${btoa(value)}`;
  return output;
}
function view(props: Partial<ComponentProps<typeof BoardAppearance>> = {}) {
  return (
    <NextIntlClientProvider locale="en" timeZone="UTC" messages={messages}>
      <BoardAppearance
        photoMode="illustrated"
        boardName="Our party"
        cards={[]}
        onSave={async () => true}
        {...props}
      />
    </NextIntlClientProvider>
  );
}

beforeEach(() => {
  installPrintPalettes();
  window.history.replaceState(null, '', '/');
  // Next synchronizes native history updates with useSearchParams. Simulate
  // that subscription here; browser tests also exercise the real router.
  for (const method of ['pushState', 'replaceState'] as const) {
    const original = window.history[method].bind(window.history);
    vi.spyOn(window.history, method).mockImplementation(
      (data: unknown, unused: string, url?: string | URL | null) => {
        original(data, unused, url);
        window.dispatchEvent(new PopStateEvent('popstate'));
      }
    );
  }
  renderBoard.mockReset();
  renderBoard.mockResolvedValue(canvas('initial'));
});
afterEach(() => vi.restoreAllMocks());

describe('automatic board preview', () => {
  it('protects an unfinished color edit and lets Escape restore the saved color', async () => {
    render(view({ styles: { presetId: 'halloween' } }));
    fireEvent.click(screen.getByRole('button', { name: 'Customize' }));
    const field = await screen.findByRole('textbox', { name: 'Background' });
    fireEvent.change(field, { target: { value: '#12' } });
    const leaving = new Event('beforeunload', { cancelable: true });
    window.dispatchEvent(leaving);
    expect(leaving.defaultPrevented).toBe(true);
    fireEvent.keyDown(field, { key: 'Escape' });
    expect(field).toHaveValue('#21152e');
    const restored = new Event('beforeunload', { cancelable: true });
    window.dispatchEvent(restored);
    expect(restored.defaultPrevented).toBe(false);
  });
  it('shows the selected design even before the first photo is ready', async () => {
    render(view({ styles: { presetId: 'halloween', showTitle: true } }));
    expect(await screen.findByRole('img', { name: previewName })).toBeVisible();
    expect(renderBoard).toHaveBeenCalledWith(
      [],
      { presetId: 'halloween', showTitle: true },
      'Sample · Our party',
      expect.objectContaining({ scale: 0.25 })
    );
    expect(screen.getByText(messages.Themes.Builder.emptyPreview)).toBeVisible();
  });

  it('keeps the previous image while rendering and ignores a stale completion', async () => {
    const { rerender } = render(view({ styles: { presetId: 'classic' } }));
    await screen.findByRole('img', { name: previewName });
    let finishSlow!: (value: HTMLCanvasElement) => void;
    renderBoard.mockReturnValueOnce(
      new Promise((resolve) => {
        finishSlow = resolve;
      })
    );
    rerender(view({ styles: { presetId: 'halloween' } }));
    expect(screen.getByRole('img', { name: previewName })).toHaveAttribute(
      'src',
      canvas('initial').toDataURL()
    );
    renderBoard.mockResolvedValueOnce(canvas('wedding'));
    rerender(view({ styles: { presetId: 'wedding' } }));
    await waitFor(() =>
      expect(screen.getByRole('img', { name: previewName })).toHaveAttribute(
        'src',
        canvas('wedding').toDataURL()
      )
    );
    await act(async () => finishSlow(canvas('halloween')));
    expect(screen.getByRole('img', { name: previewName })).toHaveAttribute(
      'src',
      canvas('wedding').toDataURL()
    );
  });

  it('updates the title and clears the board when its last card is removed', async () => {
    const { rerender } = render(
      view({
        styles: { presetId: 'wedding', showTitle: true },
        cards: [{ id: '1', number: 1, label: 'La Flor', illustration: '/flower.webp' }],
      })
    );
    await screen.findByRole('img', { name: previewName });
    renderBoard.mockResolvedValueOnce(canvas('empty'));
    rerender(view({ styles: { presetId: 'wedding', showTitle: false } }));
    await waitFor(() =>
      expect(screen.getByRole('img', { name: previewName })).toHaveAttribute(
        'src',
        canvas('empty').toDataURL()
      )
    );
    expect(renderBoard).toHaveBeenLastCalledWith(
      [],
      { presetId: 'wedding', showTitle: false },
      'Sample',
      expect.objectContaining({ scale: 0.25 })
    );
  });

  it('offers a working retry when rendering fails', async () => {
    renderBoard.mockRejectedValueOnce(new Error('Image unavailable'));
    render(view());
    expect(await screen.findByRole('alert')).toHaveTextContent(
      messages.Themes.Builder.previewError
    );
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
    expect(await screen.findByRole('img', { name: previewName })).toBeVisible();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('previews all 54 cards in number order, leaving the last page partial', async () => {
    const cards = Array.from({ length: 54 }, (_, i) => ({
      id: String(i + 1),
      number: i + 1,
      label: `Card ${i + 1}`,
      illustration: `/card-${i + 1}.webp`,
    })).reverse();
    render(view({ cards, styles: { presetId: 'birthday', showTitle: true } }));
    await screen.findByRole('img', { name: previewName });
    expect(cards[0].number).toBe(54);
    expect(screen.getByRole('button', { name: 'Previous preview page' })).toBeDisabled();
    for (let page = 0; page < 4; page++) {
      const first = page * 16 + 1;
      const last = Math.min(first + 15, 54);
      await waitFor(() =>
        expect(renderBoard.mock.lastCall?.[0].map((card) => card.number)).toEqual(
          Array.from({ length: last - first + 1 }, (_, i) => first + i)
        )
      );
      expect(screen.getByText(`Page ${page + 1} of 4`)).toBeVisible();
      expect(screen.getByText(`Cards ${first}–${last}`)).toBeVisible();
      expect(renderBoard.mock.lastCall?.[2]).toBe('Our party');
      expect(screen.getByText(messages.Themes.Builder.fullPreview)).toBeVisible();
      if (page < 3) fireEvent.click(screen.getByRole('button', { name: 'Next preview page' }));
    }
    expect(screen.getByRole('button', { name: 'Next preview page' })).toBeDisabled();
    expect(window.location.search).toBe('?previewPage=4');
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Previous preview page' }));
    });
    expect(screen.getByText('Cards 33–48')).toBeVisible();
  });

  it('excludes unfinished cards and moves to a valid page when cards are removed', async () => {
    const ready = Array.from({ length: 17 }, (_, i) => ({
      id: String(i + 1),
      number: i + 1,
      label: `Card ${i + 1}`,
      illustration: `/card-${i + 1}.webp`,
    }));
    const { rerender } = render(
      view({
        cards: [
          ...ready,
          { ...ready[0], id: 'processing', number: 18, isProcessing: true },
          { ...ready[0], id: 'failed', number: 19, error: 'Failed' },
        ],
      })
    );
    await screen.findByRole('img', { name: previewName });
    fireEvent.click(screen.getByRole('button', { name: 'Next preview page' }));
    await waitFor(() =>
      expect(renderBoard.mock.lastCall?.[0].map((card) => card.number)).toEqual([17])
    );
    rerender(view({ cards: ready.slice(0, 4) }));
    await waitFor(() => expect(window.location.search).toBe(''));
    expect(screen.queryByRole('navigation', { name: 'Preview pages' })).not.toBeInTheDocument();
    expect(renderBoard.mock.lastCall?.[2]).toBe('Sample');
    expect(renderBoard.mock.lastCall?.[0].map((card) => card.number)).toEqual([1, 2, 3, 4]);
  });
});
