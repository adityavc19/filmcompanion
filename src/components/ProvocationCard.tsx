"use client";

import { useState, useEffect } from "react";
import { type ProvocationCard as CardType, getNudge } from "@/lib/cards";
import SpectrumSlider from "./SpectrumSlider";

interface ProvocationCardProps {
  card: CardType;
  totalCards: number;
  sliderValue: number | null;
  onSliderChange: (value: number) => void;
  writtenText: string;
  onWrittenTextChange: (text: string) => void;
  onSliderFirstTouch: () => void;
}

export default function ProvocationCard({
  card,
  totalCards,
  sliderValue,
  onSliderChange,
  writtenText,
  onWrittenTextChange,
  onSliderFirstTouch,
}: ProvocationCardProps) {
  const [showNudge, setShowNudge] = useState(false);
  const [writeExpanded, setWriteExpanded] = useState(!card.hasSlider);
  const nudgeText = sliderValue !== null ? getNudge(card, sliderValue) : null;

  // Show nudge after slider is released (small delay for feel)
  useEffect(() => {
    if (sliderValue !== null && card.hasSlider) {
      const timer = setTimeout(() => setShowNudge(true), 400);
      return () => clearTimeout(timer);
    }
    setShowNudge(false);
  }, [sliderValue !== null, card.hasSlider]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="flex flex-col h-full px-6 py-6">
      {/* Type label + progress */}
      <div className="flex justify-between items-center mb-8">
        <span className="text-xs font-mono tracking-[0.15em] uppercase text-accent">
          {card.type}
        </span>
        <span className="text-xs text-muted font-mono">
          {card.id} of {totalCards}
        </span>
      </div>

      {/* Provocation text */}
      <p className="text-[17px] leading-[1.6] text-text/90 font-normal mb-8 flex-shrink-0">
        {card.provocation}
      </p>

      {/* Slider (Cards 1-3) */}
      {card.hasSlider && card.leftPole && card.rightPole && (
        <div className="mb-6">
          <SpectrumSlider
            leftPole={card.leftPole}
            rightPole={card.rightPole}
            value={sliderValue}
            onChange={onSliderChange}
            onFirstTouch={onSliderFirstTouch}
          />
        </div>
      )}

      {/* Nudge text */}
      {showNudge && nudgeText && (
        <p
          className="text-sm text-muted leading-relaxed mb-6 transition-opacity duration-500"
          style={{ opacity: showNudge ? 1 : 0 }}
        >
          {nudgeText}
        </p>
      )}

      {/* Write your take */}
      {card.hasSlider && !writeExpanded && sliderValue !== null && (
        <button
          onClick={() => setWriteExpanded(true)}
          className="text-left text-sm text-accent/80 hover:text-accent py-3 px-4 rounded-lg border border-dashed border-text/10 hover:border-accent/30 transition-colors mb-4"
        >
          Write your take (optional)
        </button>
      )}

      {/* Text area — always shown for Card 4, expandable for others */}
      {(writeExpanded || !card.hasSlider) && (
        <textarea
          value={writtenText}
          onChange={(e) => onWrittenTextChange(e.target.value)}
          placeholder={card.writePlaceholder}
          maxLength={card.hasSlider ? 200 : 500}
          rows={card.hasSlider ? 3 : 5}
          className="w-full bg-surface text-text text-sm leading-relaxed rounded-lg px-4 py-3 resize-none placeholder:text-muted/50 focus:outline-none focus:ring-1 focus:ring-accent/30 mb-4"
        />
      )}

      {/* Spacer */}
      <div className="flex-1" />

      {/* Advance hint */}
      <div className="text-center pb-2">
        {card.hasSlider && sliderValue === null ? (
          <p className="text-xs text-muted/40">
            slide to unlock
          </p>
        ) : (
          <p className="text-xs text-muted/50">
            swipe or tap → to continue
          </p>
        )}
      </div>
    </div>
  );
}
