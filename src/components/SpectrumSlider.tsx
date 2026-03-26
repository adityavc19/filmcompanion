"use client";

import { useRef, useState, useCallback, useEffect } from "react";

interface SpectrumSliderProps {
  leftPole: string;
  rightPole: string;
  value: number | null;
  onChange: (value: number) => void;
  onFirstTouch?: () => void;
}

export default function SpectrumSlider({
  leftPole,
  rightPole,
  value,
  onChange,
  onFirstTouch,
}: SpectrumSliderProps) {
  const trackRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const hasTouched = useRef(false);

  const getPositionFromEvent = useCallback(
    (clientX: number): number => {
      if (!trackRef.current) return 50;
      const rect = trackRef.current.getBoundingClientRect();
      const x = clientX - rect.left;
      const pct = Math.round(Math.max(0, Math.min(100, (x / rect.width) * 100)));
      return pct;
    },
    []
  );

  const handleStart = useCallback(
    (clientX: number) => {
      setIsDragging(true);
      if (!hasTouched.current) {
        hasTouched.current = true;
        onFirstTouch?.();
      }
      onChange(getPositionFromEvent(clientX));
    },
    [getPositionFromEvent, onChange, onFirstTouch]
  );

  const handleMove = useCallback(
    (clientX: number) => {
      if (!isDragging) return;
      onChange(getPositionFromEvent(clientX));
    },
    [isDragging, getPositionFromEvent, onChange]
  );

  const handleEnd = useCallback(() => {
    setIsDragging(false);
  }, []);

  useEffect(() => {
    if (!isDragging) return;
    const onMove = (e: MouseEvent) => handleMove(e.clientX);
    const onUp = () => handleEnd();
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
  }, [isDragging, handleMove, handleEnd]);

  useEffect(() => {
    if (!isDragging) return;
    const onMove = (e: TouchEvent) => {
      e.preventDefault();
      handleMove(e.touches[0].clientX);
    };
    const onUp = () => handleEnd();
    window.addEventListener("touchmove", onMove, { passive: false });
    window.addEventListener("touchend", onUp);
    return () => {
      window.removeEventListener("touchmove", onMove);
      window.removeEventListener("touchend", onUp);
    };
  }, [isDragging, handleMove, handleEnd]);

  const showDot = value !== null;

  return (
    <div className="w-full select-none">
      {/* Track */}
      <div
        ref={trackRef}
        className="relative h-12 flex items-center cursor-pointer touch-none"
        onMouseDown={(e) => handleStart(e.clientX)}
        onTouchStart={(e) => handleStart(e.touches[0].clientX)}
      >
        {/* Track line */}
        <div className="absolute left-0 right-0 h-[2px] bg-text/20 rounded-full" />

        {/* Active fill */}
        {showDot && (
          <div
            className="absolute left-0 h-[2px] bg-accent/50 rounded-full transition-[width] duration-75"
            style={{ width: `${value}%` }}
          />
        )}

        {/* Dot */}
        {showDot && (
          <div
            className="absolute w-5 h-5 -translate-x-1/2 rounded-full bg-accent shadow-[0_0_12px_rgba(232,183,74,0.4)] transition-[left] duration-75"
            style={{ left: `${value}%` }}
          />
        )}

        {/* Tap hint when no value */}
        {!showDot && (
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="text-xs text-muted/60 animate-pulse">
              tap or drag to take a position
            </span>
          </div>
        )}
      </div>

      {/* Pole labels */}
      <div className="flex justify-between mt-1">
        <span className="text-xs text-muted max-w-[40%]">{leftPole}</span>
        <span className="text-xs text-muted max-w-[40%] text-right">
          {rightPole}
        </span>
      </div>
    </div>
  );
}
