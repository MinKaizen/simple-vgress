'use client';

import * as React from 'react';
import { cn } from '@/lib/utils';

interface DiffSliderProps {
  baselineUrl: string;
  currentUrl: string;
  className?: string;
}

export function DiffSlider({ baselineUrl, currentUrl, className }: DiffSliderProps) {
  const [sliderPosition, setSliderPosition] = React.useState(50);
  const [isDragging, setIsDragging] = React.useState(false);
  const containerRef = React.useRef<HTMLDivElement>(null);

  const handleMouseMove = React.useCallback(
    (e: MouseEvent | React.MouseEvent) => {
      if (!containerRef.current) return;
      
      const rect = containerRef.current.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const percentage = Math.max(0, Math.min(100, (x / rect.width) * 100));
      setSliderPosition(percentage);
    },
    []
  );

  const handleMouseDown = (e: React.MouseEvent) => {
    setIsDragging(true);
    handleMouseMove(e);
  };

  React.useEffect(() => {
    const handleGlobalMouseMove = (e: MouseEvent) => {
      if (isDragging) {
        handleMouseMove(e);
      }
    };

    const handleGlobalMouseUp = () => {
      setIsDragging(false);
    };

    if (isDragging) {
      document.addEventListener('mousemove', handleGlobalMouseMove);
      document.addEventListener('mouseup', handleGlobalMouseUp);
    }

    return () => {
      document.removeEventListener('mousemove', handleGlobalMouseMove);
      document.removeEventListener('mouseup', handleGlobalMouseUp);
    };
  }, [isDragging, handleMouseMove]);

  return (
    <div
      ref={containerRef}
      className={cn('relative overflow-hidden cursor-col-resize select-none', className)}
      onMouseDown={handleMouseDown}
    >
      {/* Baseline image (left side) */}
      <div className="absolute inset-0">
        <img
          src={baselineUrl}
          alt="Baseline"
          className="w-full h-full object-contain"
          draggable={false}
        />
        <div className="absolute top-2 left-2 bg-green-600 text-white text-xs px-2 py-1 rounded">
          Baseline
        </div>
      </div>

      {/* Current image (right side, clipped) */}
      <div
        className="absolute inset-0 overflow-hidden"
        style={{ clipPath: `inset(0 0 0 ${sliderPosition}%)` }}
      >
        <img
          src={currentUrl}
          alt="Current"
          className="w-full h-full object-contain"
          draggable={false}
        />
        <div className="absolute top-2 right-2 bg-red-600 text-white text-xs px-2 py-1 rounded">
          Current
        </div>
      </div>

      {/* Slider line */}
      <div
        className="absolute top-0 bottom-0 w-0.5 bg-white shadow-lg z-10"
        style={{ left: `${sliderPosition}%`, transform: 'translateX(-50%)' }}
      >
        {/* Slider handle */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-8 h-8 bg-white rounded-full shadow-lg flex items-center justify-center">
          <div className="flex gap-0.5">
            <div className="w-0.5 h-4 bg-gray-400 rounded" />
            <div className="w-0.5 h-4 bg-gray-400 rounded" />
          </div>
        </div>
      </div>

      {/* Invisible layer to capture mouse events */}
      <div className="absolute inset-0" style={{ pointerEvents: 'none' }} />
    </div>
  );
}
