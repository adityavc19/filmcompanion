"use client";

import { useState, useCallback, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useRouter, useParams } from "next/navigation";
import { type ProvocationCard as CardType, type FilmProvocations } from "@/lib/cards";
import { track } from "@/lib/analytics";
import { encodePayload } from "@/lib/share";
import ProvocationCard from "@/components/ProvocationCard";

interface CardState {
  sliderValue: number | null;
  writtenText: string;
  sliderTouched: boolean;
}

export default function SequencePage() {
  const router = useRouter();
  const params = useParams();
  const filmId = params.id as string;

  const [provocations, setProvocations] = useState<FilmProvocations | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [direction, setDirection] = useState(0);
  const [cardStates, setCardStates] = useState<CardState[]>([]);

  // Load provocations: check sessionStorage first, then fetch from API
  useEffect(() => {
    const cacheKey = `fc_provocations_${filmId}`;

    function applyProvocations(data: FilmProvocations) {
      setProvocations(data);
      setCardStates(
        data.cards.map(() => ({
          sliderValue: null,
          writtenText: "",
          sliderTouched: false,
        }))
      );
      // Cache in sessionStorage for this session
      sessionStorage.setItem(cacheKey, JSON.stringify(data));
    }

    // Check client cache first
    try {
      const cached = sessionStorage.getItem(cacheKey);
      if (cached) {
        applyProvocations(JSON.parse(cached));
        setLoading(false);
        return;
      }
    } catch { /* no cache */ }

    // Fetch from API (which has its own server-side cache)
    async function fetchProvocations() {
      try {
        const res = await fetch(`/api/provocations?filmId=${filmId}`);
        if (!res.ok) throw new Error("Failed to load");
        const data: FilmProvocations = await res.json();
        applyProvocations(data);
      } catch {
        setError("Couldn't generate provocations. Try again.");
      } finally {
        setLoading(false);
      }
    }
    fetchProvocations();
  }, [filmId]);

  const cards = provocations?.cards ?? [];
  const currentCard = cards[currentIndex];
  const currentState = cardStates[currentIndex];
  const canAdvance = currentCard?.hasSlider
    ? currentState?.sliderTouched
    : true;
  const isLastCard = currentIndex === cards.length - 1;

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

    track("card_advance", {
      card_number: currentIndex + 1,
      spectrum_position: currentState?.sliderValue,
      wrote_reaction: (currentState?.writtenText?.length ?? 0) > 0,
    });

    if (isLastCard) {
      const positions = cardStates.map((s) => s.sliderValue ?? -1);
      const texts = cardStates.map((s) => s.writtenText);
      // Store provocations + positions in sessionStorage for discuss page
      sessionStorage.setItem(
        `fc_provocations_${filmId}`,
        JSON.stringify(provocations)
      );
      sessionStorage.setItem(
        `fc_positions_${filmId}`,
        JSON.stringify({ positions, texts })
      );
      const payload = encodePayload({ positions, texts });
      router.push(`/film/${filmId}/summary?d=${payload}`);
      return;
    }
    setDirection(1);
    setCurrentIndex((i) => i + 1);
  }, [canAdvance, isLastCard, currentIndex, currentState, cardStates, provocations, filmId, router]);

  const goBack = useCallback(() => {
    if (currentIndex === 0) return;
    setDirection(-1);
    setCurrentIndex((i) => i - 1);
  }, [currentIndex]);

  const handleDragEnd = useCallback(
    (_: unknown, info: { offset: { x: number }; velocity: { x: number } }) => {
      if (info.offset.x < -50 || info.velocity.x < -300) goNext();
      else if (info.offset.x > 50 || info.velocity.x > 300) goBack();
    },
    [goNext, goBack]
  );

  const variants = {
    enter: (dir: number) => ({ x: dir > 0 ? "100%" : "-100%", opacity: 0 }),
    center: { x: 0, opacity: 1 },
    exit: (dir: number) => ({ x: dir > 0 ? "-100%" : "100%", opacity: 0 }),
  };

  if (loading) {
    return (
      <div className="flex flex-col min-h-screen bg-bg text-text items-center justify-center gap-4">
        <div className="w-8 h-8 border-2 border-accent/30 border-t-accent rounded-full animate-spin" />
        <p className="text-sm text-muted">Generating provocations...</p>
        <p className="text-xs text-muted/60">Reading the discourse on this film</p>
      </div>
    );
  }

  if (error || !provocations || cards.length === 0) {
    return (
      <div className="flex flex-col min-h-screen bg-bg text-text items-center justify-center gap-4 px-6">
        <p className="text-sm text-muted">{error || "Something went wrong."}</p>
        <button
          onClick={() => router.back()}
          className="text-sm text-accent hover:underline"
        >
          ← Go back
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col min-h-screen bg-bg text-text overflow-hidden">
      <div className="w-full max-w-[430px] mx-auto flex flex-col min-h-screen relative">
        {/* Progress dots */}
        <div className="flex justify-center gap-2 pt-5 pb-2 px-6 z-20">
          {cards.map((_: CardType, i: number) => (
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
                totalCards={cards.length}
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

        {/* Navigation */}
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
