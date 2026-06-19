import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { RecropButton } from '@/app/(admin)/admin/components/recrop-button';

vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: vi.fn() }) }));
vi.mock('@/app/(admin)/admin/components/image-crop-modal', () => ({ ImageCropModal: () => null }));

describe('RecropButton', () => {
  it('renders a Re-crop button', () => {
    render(<RecropButton cardId="c1" boardId="b1" initialCrop={null} />);
    expect(screen.getByRole('button', { name: /re-crop/i })).toBeInTheDocument();
  });
});
