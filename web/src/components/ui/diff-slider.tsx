'use client';

import * as React from 'react';
import { cn } from '@/lib/utils';

interface DiffSliderProps {
  baselineUrls: string[];
  currentUrls: string[];
  className?: string;
}

export function DiffSlider({ baselineUrls, currentUrls, className }: DiffSliderProps) {
  const containerRef = React.useRef<HTMLDivElement>(null);
  const currentLayerRef = React.useRef<HTMLDivElement>(null);
  const sliderLineRef = React.useRef<HTMLDivElement>(null);
  const isDragging = React.useRef(false);

  const updatePosition = React.useCallback((clientX: number) => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const pct = Math.max(0, Math.min(100, ((clientX - rect.left) / rect.width) * 100));

    if (currentLayerRef.current) {
      currentLayerRef.current.style.clipPath = `inset(0 ${100 - pct}% 0 0)`;
    }
    if (sliderLineRef.current) {
      sliderLineRef.current.style.left = `${pct}%`;
    }
  }, []);

  const handleMouseDown = React.useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    isDragging.current = true;
    updatePosition(e.clientX);
  }, [updatePosition]);

  const handleTouchStart = React.useCallback((e: React.TouchEvent) => {
    isDragging.current = true;
    updatePosition(e.touches[0].clientX);
  }, [updatePosition]);

  React.useEffect(() => {
    const onMouseMove = (e: MouseEvent) => {
      if (isDragging.current) updatePosition(e.clientX);
    };
    const onTouchMove = (e: TouchEvent) => {
      if (isDragging.current) {
        e.preventDefault();
        updatePosition(e.touches[0].clientX);
      }
    };
    const onUp = () => { isDragging.current = false; };

    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onUp);
    document.addEventListener('touchmove', onTouchMove, { passive: false });
    document.addEventListener('touchend', onUp);

    return () => {
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onUp);
      document.removeEventListener('touchmove', onTouchMove);
      document.removeEventListener('touchend', onUp);
    };
  }, [updatePosition]);

  return (
    <div
      ref={containerRef}
      className={cn('relative overflow-hidden cursor-col-resize select-none', className)}
      onMouseDown={handleMouseDown}
      onTouchStart={handleTouchStart}
    >
      {/* Baseline images — sets container height */}
      <div className="relative w-full">
        {baselineUrls.map((url, i) => (
          <img
            key={i}
            src={url}
            alt={`Baseline part ${i + 1}`}
            className="w-full block"
            style={{ marginTop: i > 0 ? -1 : 0 }}
            draggable={false}
          />
        ))}
        <div className="absolute top-2 left-2 bg-green-600 text-white text-xs px-2 py-1 rounded z-10 pointer-events-none">
          Baseline
        </div>
      </div>

      {/* Current images — absolutely overlaid, clipped from right */}
      <div
        ref={currentLayerRef}
        className="absolute inset-0"
        style={{ clipPath: 'inset(0 50% 0 0)' }}
      >
        {currentUrls.map((url, i) => (
          <img
            key={i}
            src={url}
            alt={`Current part ${i + 1}`}
            className="w-full block"
            style={{ marginTop: i > 0 ? -1 : 0 }}
            draggable={false}
          />
        ))}
        <div className="absolute top-2 right-2 bg-red-600 text-white text-xs px-2 py-1 rounded z-10 pointer-events-none">
          Current
        </div>
      </div>

      {/* Slider line */}
      <div
        ref={sliderLineRef}
        className="absolute top-0 bottom-0 w-0.5 bg-white shadow-lg z-20 pointer-events-none"
        style={{ left: '50%', transform: 'translateX(-50%)', willChange: 'left' }}
      >
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-8 h-8 bg-white rounded-full shadow-lg flex items-center justify-center">
          <div className="flex gap-0.5">
            <div className="w-0.5 h-4 bg-gray-400 rounded" />
            <div className="w-0.5 h-4 bg-gray-400 rounded" />
          </div>
        </div>
      </div>
    </div>
  );
}
