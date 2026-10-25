import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { PhotoDropZone } from '@/components/photo-drop-zone';

function transfer(types: string[], files: File[] = []) {
  return { dataTransfer: { types, files } };
}

describe('PhotoDropZone', () => {
  it('adds dropped photos and highlights while they hover', () => {
    const onDropFiles = vi.fn();
    render(
      <PhotoDropZone onDropFiles={onDropFiles}>
        <p>cards</p>
      </PhotoDropZone>
    );
    const zone = screen.getByText('cards').parentElement!;
    const photo = new File(['x'], 'cat.jpg', { type: 'image/jpeg' });
    fireEvent.dragOver(zone, transfer(['Files'], [photo]));
    expect(zone).toHaveClass('outline-primary');
    fireEvent.drop(zone, transfer(['Files'], [photo]));
    expect(onDropFiles).toHaveBeenCalledWith([photo]);
    expect(zone).not.toHaveClass('outline-primary');
  });

  it('ignores drags that carry no files', () => {
    const onDropFiles = vi.fn();
    render(
      <PhotoDropZone onDropFiles={onDropFiles}>
        <p>cards</p>
      </PhotoDropZone>
    );
    const zone = screen.getByText('cards').parentElement!;
    fireEvent.dragOver(zone, transfer(['text/plain']));
    expect(zone).not.toHaveClass('outline-primary');
    fireEvent.drop(zone, transfer(['text/plain']));
    expect(onDropFiles).not.toHaveBeenCalled();
  });
});
