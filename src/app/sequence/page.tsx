"use client";

import { useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useRouter } from "next/navigation";
import { ANORA_CARDS } from "@/lib/cards";
import { track } from "@/lib/analytics";
import ProvocationCard from "@/components/ProvocationCard";

interface CardState {
  sliderValue: number | null;
  writtenText: string;
  sliderTouched: boolean;
}

export default function SequencePage() {
  const router = useRouter();
  const [currentIndex, setCurrentIndex] = useState(0);
  const [direction, setDirection] = useState(0);
  const [cardStates, setCardStates] = useState<CardState[]>(
    ANORA_CARDS.map(() => ({
      sliderValue: null,
      writtenText: "",
      sliderTouched: false,
    }))
  );

  const currentCard = ANORA_CARDS[currentIndex];
  const currentState = cardStates[currentIndex];
  const canAdvance = currentCard.hasSlider
    ? currentState.sliderTouched
    : true; // Card 4 (open prompt) can always advance
  const isLastCard = currentIndex === ANORA_CARDS.length - 1;

  const updateCardState = useCallback(
    (index: number, updates: Partial<CardState>) => {
      setCardStates((prev) => {
        const next = [...prev];
        next[index] = { ...next[index], ...updates };
        return next;
      });
    },
    []
  );

  const goNext = useCallback(() => {
    if (!canAdvance) return;

    // Track card advance
    track("card_advance", {
      card_number: currentIndex + 1,
      spectrum_position: currentState.sliderValue,
      wrote_reaction: currentState.writtenText.length > 0,
    });

    if (isLastCard) {
      const positions = cardStates.map((s) => s.sliderValue ?? -1);
      const texts = cardStates.map((s) => s.writtenText);
      const payload = btoa(JSON.stringify({ positions, texts }));
      router.push(`/summary?d=${encodeURIComponent(payload)}`);
      return;
    }
    setDirection(1);
    setCurrentIndex((i) => i + 1);
  }, [canAdvance, isLastCard, currentIndex, currentState, cardStates, router]);

  const goBack = useCallback(() => {
    if (currentIndex === 0) return;
    setDirection(-1);
    setCurrentIndex((i) => i - 1);
  }, [currentIndex]);

  // Swipe handling
  const handleDragEnd = useCallback(
    (_: unknown, info: { offset: { x: number }; velocity: { x: number } }) => {
      const threshold = 50;
      const velocityThreshold = 300;
      if (
        info.offset.x < -threshold ||
        info.velocity.x < -velocityThreshold
      ) {
        goNext();
      } else if (
        info.offset.x > threshold ||
        info.velocity.x > velocityThreshold
      ) {
        goBack();
      }
    },
    [goNext, goBack]
  );

  const variants = {
    enter: (dir: number) => ({
      x: dir > 0 ? "100%" : "-100%",
      opacity: 0,
    }),
    center: { x: 0, opacity: 1 },
    exit: (dir: number) => ({
      x: dir > 0 ? "-100%" : "100%",
      opacity: 0,
    }),
  };

  return (
    <div className="flex flex-col min-h-screen bg-bg text-text overflow-hidden">
      <div className="w-full max-w-[430px] mx-auto flex flex-col min-h-screen relative">
        {/* Progress dots */}
        <div className="flex justify-center gap-2 pt-5 pb-2 px-6 z-20">
          {ANORA_CARDS.map((_, i) => (
            <div
              key={i}
              className={`h-1 rounded-full transition-all duration-300 ${
                i === currentIndex
                  ? "w-6 bg-accent"
                  : i < currentIndex
                  ? "w-2 bg-accent/50"
                  : "w-2 bg-text/15"
              }`}
            />
          ))}
        </div>

        {/* Card area */}
        <div className="flex-1 relative overflow-hidden">
          <AnimatePresence initial={false} custom={direction} mode="wait">
            <motion.div
              key={currentIndex}
              custom={direction}
              variants={variants}
              initial="enter"
              animate="center"
              exit="exit"
              transition={{
                x: { type: "spring", stiffness: 300, damping: 30 },
                opacity: { duration: 0.15 },
              }}
              drag="x"
              dragConstraints={{ left: 0, right: 0 }}
              dragElastic={0.15}
              onDragEnd={handleDragEnd}
              className="absolute inset-0"
            >
              <ProvocationCard
                card={currentCard}
                totalCards={ANORA_CARDS.length}
                sliderValue={currentState.sliderValue}
                onSliderChange={(val) =>
                  updateCardState(currentIndex, {
                    sliderValue: val,
                    sliderTouched: true,
                  })
                }
                writtenText={currentState.writtenText}
                onWrittenTextChange={(text) =>
                  updateCardState(currentIndex, { writtenText: text })
                }
                onSliderFirstTouch={() =>
                  updateCardState(currentIndex, { sliderTouched: true })
                }
              />
            </motion.div>
          </AnimatePresence>
        </div>

        {/* Navigation buttons */}
        <div className="flex justify-between items-center px-6 py-4 z-20">
          <button
            onClick={goBack}
            disabled={currentIndex === 0}
            className="text-sm text-muted disabled:opacity-20 transition-opacity"
          >
            ← Back
          </button>
          <button
            onClick={goNext}
            disabled={!canAdvance}
            className={`text-sm font-medium px-5 py-2 rounded-lg transition-all ${
              canAdvance
                ? "bg-accent text-bg hover:brightness-110 active:scale-95"
                : "bg-text/10 text-muted/40 cursor-not-allowed"
            }`}
          >
            {isLastCard ? "See your positions →" : "Next →"}
          </button>
        </div>
      </div>
    </div>
  );
}
