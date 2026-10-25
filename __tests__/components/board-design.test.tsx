import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { NextIntlClientProvider } from 'next-intl';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useState, useSyncExternalStore, type ComponentProps } from 'react';
import { BoardPreviewPanel } from '@/components/board-preview-panel';
import type { BoardStyleOptions } from '@/lib/themes/presets';
import { renderBoardToCanvas } from '@/lib/generate-boards';
import messages from '@/messages/en.json';
import { installPrintPalettes } from '../helpers/print-palettes';

vi.mock('@/hooks/use-mobile', () => ({ useIsMobile: () => false }));
vi.mock('@/lib/themes/fonts', () => ({ loadPrintFont: async () => {} }));
vi.mock('@/lib/generate-boards', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/generate-boards')>()),
  renderBoardToCanvas: vi.fn(),
}));
vi.mock('@/lib/record-board-export', () => ({ recordBoardExport: vi.fn() }));
vi.mock('posthog-js', () => ({ default: { capture: vi.fn(), captureException: vi.fn() } }));
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
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

let desktop = true;
function setViewport(isDesktop: boolean) {
  desktop = isDesktop;
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: (query: string) => ({
      matches: query.includes('min-width: 1024px') ? desktop : false,
      media: query,
      addEventListener: () => {},
      removeEventListener: () => {},
      addListener: () => {},
      removeListener: () => {},
    }),
  });
}

function canvas(value: string) {
  const output = document.createElement('canvas');
  output.toDataURL = () => `data:image/png;base64,${btoa(value)}`;
  return output;
}

type PanelProps = ComponentProps<typeof BoardPreviewPanel>;

/** Like the board page: a successful save becomes the board's saved styles. */
function Board({
  initialStyles,
  onSave,
}: {
  initialStyles: BoardStyleOptions;
  onSave: PanelProps['onSaveDesign'];
}) {
  const [styles, setStyles] = useState(initialStyles);
  return (
    <BoardPreviewPanel
      boardId="board-1"
      boardName="Our party"
      cards={[]}
      photoMode="original"
      isUnlocked
      styles={styles}
      canAddPhotos
      onAddPhotos={() => {}}
      onUnlock={() => {}}
      onSaveDesign={async (settings) => {
        const saved = await onSave(settings);
        if (saved && settings.styleOptions) setStyles(settings.styleOptions);
        return saved;
      }}
    />
  );
}

function view({
  styles = { presetId: 'halloween', showTitle: true },
  onSave = async () => true,
}: { styles?: BoardStyleOptions; onSave?: PanelProps['onSaveDesign'] } = {}) {
  return render(
    <NextIntlClientProvider locale="en" timeZone="UTC" messages={messages}>
      <Board initialStyles={styles} onSave={onSave} />
    </NextIntlClientProvider>
  );
}

const lastRenderedStyle = () => renderBoard.mock.lastCall?.[1];

beforeEach(() => {
  installPrintPalettes();
  setViewport(true);
  window.history.replaceState(null, '', '/');
  // Next synchronizes native history updates with useSearchParams.
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
  renderBoard.mockImplementation(async (_cards, style) => canvas(JSON.stringify(style)));
});
afterEach(() => vi.restoreAllMocks());

describe('desktop design dialog', () => {
  it('shows the theme beside the preview and opens the dialog from Change…', async () => {
    view();
    const sidebar = screen.getByRole('complementary', { name: 'Live preview' });
    expect(within(sidebar).getByText('Halloween')).toBeVisible();
    const change = within(sidebar).getByRole('button', {
      name: 'Change theme, currently Halloween',
    });
    expect(change).toHaveTextContent('Change…');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();

    change.focus();
    fireEvent.click(change);
    expect(window.location.search).toBe('?design=1');
    const dialog = await screen.findByRole('dialog', { name: 'Design your set' });
    expect(within(dialog).getByRole('button', { name: 'Halloween' })).toHaveAttribute(
      'aria-pressed',
      'true'
    );
    expect(within(dialog).getByRole('status')).toHaveTextContent('Saved');
    // Colors and font come first and start open; themes are starting points below.
    const customize = within(dialog).getByRole('button', { name: 'Customize colors & font' });
    expect(customize).toHaveAttribute('aria-expanded', 'true');
    const themes = within(dialog).getByRole('region', { name: 'Or start from a theme' });
    expect(
      customize.compareDocumentPosition(themes) & Node.DOCUMENT_POSITION_FOLLOWING
    ).toBeTruthy();
    expect(
      within(dialog).getByRole('img', { name: messages.Themes.Builder.previewAlt })
    ).toBeVisible();

    fireEvent.click(within(dialog).getByRole('button', { name: 'Done' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(window.location.search).toBe('');
    await waitFor(() => expect(change).toHaveFocus());
  });

  it('opens straight into the dialog from a ?design=1 link and closes with Escape', async () => {
    window.history.replaceState(null, '', '/?previewPage=1&design=1');
    view();
    const dialog = await screen.findByRole('dialog', { name: 'Design your set' });
    expect(dialog).toHaveAccessibleDescription(messages.Themes.Builder.designSubtitle);
    fireEvent.keyDown(dialog, { key: 'Escape' });
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(window.location.search).toBe('?previewPage=1');
  });

  it('saves a picked theme and shows it in every preview', async () => {
    window.history.replaceState(null, '', '/?design=1');
    const onSave = vi.fn(async () => true);
    view({ onSave });
    const dialog = await screen.findByRole('dialog', { name: 'Design your set' });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Wedding' }));
    await waitFor(() =>
      expect(within(dialog).getByRole('button', { name: 'Wedding' })).toHaveAttribute(
        'aria-pressed',
        'true'
      )
    );
    expect(onSave).toHaveBeenCalledWith({
      styleOptions: expect.objectContaining({ presetId: 'wedding', showTitle: true }),
    });
    await waitFor(() =>
      expect(lastRenderedStyle()).toEqual(expect.objectContaining({ presetId: 'wedding' }))
    );
    fireEvent.click(within(dialog).getByRole('button', { name: 'Done' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(screen.getByRole('button', { name: 'Change theme, currently Wedding' })).toBeVisible();
  });

  it('shows a custom design in Customize and saves the board-name setting', async () => {
    window.history.replaceState(null, '', '/?design=1');
    const onSave = vi.fn(async () => true);
    view({ styles: { presetId: 'custom', backgroundColor: '#123456', showTitle: true }, onSave });
    const dialog = await screen.findByRole('dialog', { name: 'Design your set' });
    expect(within(dialog).getByRole('button', { name: 'Customize colors & font' })).toHaveAttribute(
      'aria-expanded',
      'true'
    );
    expect(within(dialog).getByRole('textbox', { name: 'Background' })).toHaveValue('#123456');
    const showTitle = within(dialog).getByRole('checkbox', {
      name: /Print the board name at the top/,
    });
    expect(showTitle).toBeChecked();
    fireEvent.click(showTitle);
    await waitFor(() =>
      expect(onSave).toHaveBeenCalledWith({
        styleOptions: expect.objectContaining({ presetId: 'custom', showTitle: false }),
      })
    );
    await waitFor(() => expect(showTitle).not.toBeChecked());
  });

  it('shows typed colors immediately and saves them once typing settles', async () => {
    window.history.replaceState(null, '', '/?design=1');
    const onSave = vi.fn(async () => true);
    view({ onSave });
    const dialog = await screen.findByRole('dialog', { name: 'Design your set' });
    const background = within(dialog).getByRole('textbox', { name: 'Background' });
    await waitFor(() => expect(renderBoard).toHaveBeenCalled());
    vi.useFakeTimers();
    try {
      fireEvent.change(background, { target: { value: '#12345' } });
      fireEvent.change(background, { target: { value: '#123456' } });
      expect(within(dialog).getByRole('button', { name: 'Custom' })).toHaveAttribute(
        'aria-pressed',
        'true'
      );
      expect(background).toBeEnabled();
      // The preview renders the unsaved draft right away.
      await act(async () => {});
      expect(lastRenderedStyle()).toEqual(
        expect.objectContaining({ presetId: 'custom', backgroundColor: '#123456' })
      );
      const leaving = new Event('beforeunload', { cancelable: true });
      window.dispatchEvent(leaving);
      expect(leaving.defaultPrevented).toBe(true);
      expect(onSave).not.toHaveBeenCalled();
      await act(async () => {
        await vi.advanceTimersByTimeAsync(400);
      });
      expect(onSave).toHaveBeenCalledTimes(1);
      expect(onSave).toHaveBeenCalledWith({
        styleOptions: expect.objectContaining({ presetId: 'custom', backgroundColor: '#123456' }),
      });
      // Committing the color already saved does not write it again.
      fireEvent.blur(background);
      await act(async () => {
        await vi.advanceTimersByTimeAsync(400);
      });
      expect(onSave).toHaveBeenCalledTimes(1);
      const settled = new Event('beforeunload', { cancelable: true });
      window.dispatchEvent(settled);
      expect(settled.defaultPrevented).toBe(false);
    } finally {
      vi.useRealTimers();
    }
  });

  it('reverts to the saved design when an edit fails to save', async () => {
    window.history.replaceState(null, '', '/?design=1');
    view({ onSave: async () => false });
    const dialog = await screen.findByRole('dialog', { name: 'Design your set' });
    const background = within(dialog).getByRole('textbox', { name: 'Background' });
    fireEvent.change(background, { target: { value: '#123456' } });
    fireEvent.keyDown(background, { key: 'Enter' });
    expect(await within(dialog).findByRole('alert')).toHaveTextContent(
      'Could not save. Please try again.'
    );
    expect(within(dialog).getByRole('button', { name: 'Halloween' })).toHaveAttribute(
      'aria-pressed',
      'true'
    );
    expect(background).toHaveValue('#21152e');
  });

  it('protects an unfinished color entry and lets Escape restore the saved color', async () => {
    window.history.replaceState(null, '', '/?design=1');
    view();
    const dialog = await screen.findByRole('dialog', { name: 'Design your set' });
    const field = within(dialog).getByRole('textbox', { name: 'Background' });
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
});

describe('phone design view', () => {
  beforeEach(() => setViewport(false));

  it('swaps the preview sheet to the design view and back', async () => {
    const onSave = vi.fn(async () => true);
    view({ onSave });
    fireEvent.click(screen.getByRole('button', { name: 'Preview & download' }));
    const sheet = await screen.findByRole('dialog', { name: 'Live preview' });
    const row = within(sheet).getByRole('button', { name: 'Change theme, currently Halloween' });
    fireEvent.click(row);
    expect(window.location.search).toBe('?design=1');
    const designView = await screen.findByRole('dialog', { name: 'Design your set' });
    await waitFor(() =>
      expect(within(designView).getByRole('button', { name: 'Back to preview' })).toHaveFocus()
    );
    fireEvent.click(within(designView).getByRole('button', { name: 'Birthday' }));
    await waitFor(() =>
      expect(within(designView).getByRole('button', { name: 'Birthday' })).toHaveAttribute(
        'aria-pressed',
        'true'
      )
    );
    fireEvent.click(within(designView).getByRole('button', { name: 'Done' }));
    const back = await screen.findByRole('dialog', { name: 'Live preview' });
    expect(window.location.search).toBe('');
    await waitFor(() =>
      expect(
        within(back).getByRole('button', { name: 'Change theme, currently Birthday' })
      ).toHaveFocus()
    );
  });

  it('opens a ?design=1 link in the design view, and Back keeps the sheet open', async () => {
    window.history.replaceState(null, '', '/?design=1');
    view();
    const designView = await screen.findByRole('dialog', { name: 'Design your set' });
    fireEvent.click(within(designView).getByRole('button', { name: 'Back to preview' }));
    expect(await screen.findByRole('dialog', { name: 'Live preview' })).toBeVisible();
    expect(window.location.search).toBe('');
  });
});
