'use client';

import * as React from 'react';
import { cn } from '@/lib/utils';

interface ImageStitcherProps {
  images: string[];
  className?: string;
  alt?: string;
}

export function ImageStitcher({ images, className, alt = 'Stitched screenshot' }: ImageStitcherProps) {
  const [loadedImages, setLoadedImages] = React.useState<Set<number>>(new Set());

  const handleImageLoad = (index: number) => {
    setLoadedImages((prev) => new Set(prev).add(index));
  };

  if (images.length === 0) {
    return (
      <div className={cn('flex items-center justify-center bg-[var(--muted)] rounded-lg p-8', className)}>
        <p className="text-[var(--muted-foreground)]">No images to display</p>
      </div>
    );
  }

  return (
    <div className={cn('flex flex-col', className)}>
      {images.map((src, index) => (
        <div key={src} className="relative">
          {!loadedImages.has(index) && (
            <div className="absolute inset-0 bg-[var(--muted)] animate-pulse" />
          )}
          <img
            src={src}
            alt={`${alt} part ${index + 1} of ${images.length}`}
            className="w-full h-auto block"
            onLoad={() => handleImageLoad(index)}
            style={{ marginTop: index > 0 ? '-1px' : 0 }} // Slight overlap to avoid gaps
          />
        </div>
      ))}
    </div>
  );
}
