"use client";

import { useState } from "react";

interface StarRatingProps {
  value: number;
  onChange: (value: number) => void;
}

export default function StarRating({ value, onChange }: StarRatingProps) {
  const [hoverValue, setHoverValue] = useState<number | null>(null);
  const displayValue = hoverValue ?? value;

  const handleClick = (starIndex: number, isHalf: boolean) => {
    const newValue = isHalf ? starIndex + 0.5 : starIndex + 1;
    onChange(newValue);
  };

  return (
    <div
      className="flex gap-1 items-center"
      onMouseLeave={() => setHoverValue(null)}
    >
      {[0, 1, 2, 3, 4].map((i) => {
        const filled = displayValue >= i + 1;
        const halfFilled = !filled && displayValue >= i + 0.5;

        return (
          <div key={i} className="relative w-10 h-10 cursor-pointer">
            {/* Left half (half star) */}
            <div
              className="absolute inset-y-0 left-0 w-1/2 z-10"
              onMouseEnter={() => setHoverValue(i + 0.5)}
              onClick={() => handleClick(i, true)}
            />
            {/* Right half (full star) */}
            <div
              className="absolute inset-y-0 right-0 w-1/2 z-10"
              onMouseEnter={() => setHoverValue(i + 1)}
              onClick={() => handleClick(i, false)}
            />
            {/* Star SVG */}
            <svg viewBox="0 0 24 24" className="w-10 h-10">
              <defs>
                <linearGradient id={`half-${i}`}>
                  <stop offset="50%" stopColor="#E8B74A" />
                  <stop offset="50%" stopColor="transparent" />
                </linearGradient>
              </defs>
              <path
                d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"
                fill={
                  filled
                    ? "#E8B74A"
                    : halfFilled
                    ? `url(#half-${i})`
                    : "transparent"
                }
                stroke="#E8B74A"
                strokeWidth="1.5"
                strokeLinejoin="round"
              />
            </svg>
          </div>
        );
      })}
      {value > 0 && (
        <span className="ml-2 text-sm text-muted font-mono">{value}</span>
      )}
    </div>
  );
}
