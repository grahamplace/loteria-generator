import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ComponentProps } from 'react';
import { BoardAppearance } from '@/components/board-appearance';
import { renderBoardToCanvas } from '@/lib/generate-boards';
import messages from '@/messages/en.json';

vi.mock('@/lib/generate-boards', () => ({ renderBoardToCanvas: vi.fn() }));
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
  renderBoard.mockReset();
  renderBoard.mockResolvedValue(canvas('initial'));
});

describe('automatic board preview', () => {
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
});
