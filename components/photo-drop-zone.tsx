'use client';

import { useState, type ReactNode } from 'react';
import { cn } from '@/lib/utils';

/** Only file drags count; card reordering uses pointer events, not HTML drag and drop. */
function carriesFiles(event: React.DragEvent) {
  return Array.from(event.dataTransfer.types).includes('Files');
}

/** Accepts photos dropped anywhere inside it, highlighting while files hover. */
export function PhotoDropZone({
  onDropFiles,
  className,
  children,
}: {
  onDropFiles: (files: File[]) => void;
  className?: string;
  children: ReactNode;
}) {
  const [active, setActive] = useState(false);
  return (
    <div
      onDragOver={(event) => {
        if (!carriesFiles(event)) return;
        event.preventDefault();
        setActive(true);
      }}
      onDragLeave={(event) => {
        // Moving between children fires dragleave on the zone; ignore those.
        if (event.currentTarget.contains(event.relatedTarget as Node | null)) return;
        setActive(false);
      }}
      onDrop={(event) => {
        if (!carriesFiles(event)) return;
        event.preventDefault();
        setActive(false);
        onDropFiles(Array.from(event.dataTransfer.files));
      }}
      className={cn(
        'rounded-xl outline-2 outline-offset-4 outline-transparent outline-dashed',
        active && 'bg-primary/5 outline-primary',
        className
      )}
    >
      {children}
    </div>
  );
}
