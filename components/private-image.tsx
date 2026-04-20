'use client';

import { useState } from 'react';
import Image from 'next/image';
import { cn } from '@/lib/utils';

interface PrivateImageProps {
  boardId: string;
  cardId: string;
  type: 'original' | 'illustration';
  alt: string;
  className?: string;
  width?: number;
  height?: number;
  fill?: boolean;
  priority?: boolean;
}

/**
 * Component for displaying private images through our auth-gated API proxy
 */
export function PrivateImage({
  boardId,
  cardId,
  type,
  alt,
  className,
  width,
  height,
  fill,
  priority,
}: PrivateImageProps) {
  const [error, setError] = useState(false);
  const [loading, setLoading] = useState(true);

  const src = `/api/images/${boardId}/${cardId}/${type}`;

  if (error) {
    return (
      <div
        className={cn('flex items-center justify-center bg-muted text-muted-foreground', className)}
        style={!fill ? { width, height } : undefined}
      >
        <span className="text-xs">Image unavailable</span>
      </div>
    );
  }

  return (
    <div className={cn('relative', className)}>
      {loading && (
        <div className="absolute inset-0 flex items-center justify-center bg-muted animate-pulse">
          <span className="sr-only">Loading...</span>
        </div>
      )}
      <Image
        src={src}
        alt={alt}
        width={fill ? undefined : width}
        height={fill ? undefined : height}
        fill={fill}
        priority={priority}
        className={cn(loading && 'opacity-0', 'transition-opacity')}
        onLoad={() => setLoading(false)}
        onError={() => {
          setLoading(false);
          setError(true);
        }}
        unoptimized
      />
    </div>
  );
}
