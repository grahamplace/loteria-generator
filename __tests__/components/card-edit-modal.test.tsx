import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import posthog from 'posthog-js';
import { CardEditModal } from '@/components/card-edit-modal';
import { ReillustrateError } from '@/lib/reillustrate-error';

vi.mock('posthog-js', () => ({ default: { capture: vi.fn() } }));

vi.mock('next-intl', () => ({
  useLocale: () => 'en',
  useTranslations: (namespace: string) => {
    const messages: Record<string, Record<string, string>> = {
      'BoardEditor.CardEditModal': {
        titleWithNumber: 'Edit card #{number}',
        closeAriaLabel: 'Close',
        originalLabel: 'Original',
        illustrationLabel: 'Illustration',
        illustrationFailed: 'We couldn’t create the illustration.',
        retryIllustration: 'Try illustration again',
        useOriginalPhoto: 'Use original photo',
        useIllustration: 'Use illustration',
        labelField: 'Label',
        riddleField: 'Riddle (optional)',
        notesField: 'Notes',
        notesPlaceholder: 'Keep the glasses, make the dog brown…',
        reillustrateButton: 'Re-illustrate',
        reillustrateLimitLocked: 'You’ve used this board’s free illustrations.',
        reillustrateLimit: 'You’ve used all the illustrations for this board.',
        reillustrateUnlock: 'Unlock board',
        reillustrateError: 'Couldn’t start the illustration. Try again.',
        saveButton: 'Save',
        cancelButton: 'Cancel',
      },
    };
    const ns = messages[namespace] ?? {};
    const t = (key: string, params?: Record<string, unknown>) => {
      let val = ns[key] ?? key;
      if (params) {
        for (const [k, v] of Object.entries(params)) {
          val = val.replace(`{${k}}`, String(v));
        }
      }
      return val;
    };
    t.raw = (key: string) => ns[key];
    t.rich = (key: string) => ns[key] ?? key;
    return t;
  },
}));

const card = {
  id: 'card-1',
  number: 7,
  label: 'El Perro',
  illustration: '/illustration.png',
  promptOverlay: 'Keep the glasses',
};

function renderModal(props: Partial<React.ComponentProps<typeof CardEditModal>> = {}) {
  const defaults = {
    card,
    originalImage: '/original.jpg',
    onSave: vi.fn(),
    onClose: vi.fn(),
    onReillustrate: vi.fn().mockResolvedValue(undefined),
  };
  const merged = { ...defaults, ...props };
  render(<CardEditModal {...merged} />);
  return merged;
}

describe('CardEditModal notes + re-illustrate', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('pre-fills notes from card.promptOverlay', () => {
    renderModal();
    expect(screen.getByLabelText('Notes')).toHaveValue('Keep the glasses');
  });

  it('Re-illustrate calls onReillustrate with the notes', async () => {
    const { onReillustrate } = renderModal();
    fireEvent.change(screen.getByLabelText('Notes'), { target: { value: 'Make the dog brown' } });
    fireEvent.click(screen.getByRole('button', { name: 'Re-illustrate' }));
    await waitFor(() => expect(onReillustrate).toHaveBeenCalledWith('Make the dog brown'));
    await waitFor(() =>
      expect(posthog.capture).toHaveBeenCalledWith('card_reillustrated', {
        card_number: 7,
        has_notes: true,
        notes_length: 'Make the dog brown'.length,
      })
    );
  });

  it('Cmd+Enter in notes triggers re-illustrate', async () => {
    const { onReillustrate } = renderModal();
    fireEvent.keyDown(screen.getByLabelText('Notes'), { key: 'Enter', metaKey: true });
    await waitFor(() => expect(onReillustrate).toHaveBeenCalledWith('Keep the glasses'));
  });

  it('button disabled while isProcessing', () => {
    renderModal({ isProcessing: true });
    expect(screen.getByRole('button', { name: 'Re-illustrate' })).toBeDisabled();
  });

  it('hides notes section without onReillustrate', () => {
    renderModal({ onReillustrate: undefined });
    expect(screen.queryByLabelText('Notes')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Re-illustrate' })).not.toBeInTheDocument();
  });

  it('locked board limit error shows Unlock board, which calls onUnlockRequired', async () => {
    const onUnlockRequired = vi.fn();
    const { onClose } = renderModal({
      isLocked: true,
      onUnlockRequired,
      onReillustrate: vi.fn().mockRejectedValue(new ReillustrateError('GENERATION_LIMIT_REACHED')),
    });
    fireEvent.click(screen.getByRole('button', { name: 'Re-illustrate' }));
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'You’ve used this board’s free illustrations.'
    );
    fireEvent.click(screen.getByRole('button', { name: 'Unlock board' }));
    expect(onUnlockRequired).toHaveBeenCalled();
    expect(onClose).toHaveBeenCalled();
    expect(posthog.capture).not.toHaveBeenCalled();
  });

  it('unlocked board limit error shows the paid-limit message without Unlock', async () => {
    renderModal({
      isLocked: false,
      onUnlockRequired: vi.fn(),
      onReillustrate: vi.fn().mockRejectedValue(new ReillustrateError('GENERATION_LIMIT_REACHED')),
    });
    fireEvent.click(screen.getByRole('button', { name: 'Re-illustrate' }));
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'You’ve used all the illustrations for this board.'
    );
    expect(screen.queryByRole('button', { name: 'Unlock board' })).not.toBeInTheDocument();
  });

  it('generic failure shows reillustrateError', async () => {
    renderModal({ onReillustrate: vi.fn().mockRejectedValue(new Error('network')) });
    fireEvent.click(screen.getByRole('button', { name: 'Re-illustrate' }));
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Couldn’t start the illustration. Try again.'
    );
  });

  it('Try again after a failed job re-illustrates with notes instead of switching mode', async () => {
    const onChangePhotoMode = vi.fn().mockResolvedValue(undefined);
    const { onReillustrate } = renderModal({ processingError: 'boom', onChangePhotoMode });
    fireEvent.click(screen.getByRole('button', { name: 'Try illustration again' }));
    await waitFor(() => expect(onReillustrate).toHaveBeenCalledWith('Keep the glasses'));
    expect(onChangePhotoMode).not.toHaveBeenCalled();
  });
});
