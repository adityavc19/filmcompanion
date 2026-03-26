"use client";

import { useState, useEffect, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import Image from "next/image";
import StarRating from "@/components/StarRating";
import { ANORA_CARDS } from "@/lib/cards";

interface SequenceData {
  positions: number[];
  texts: string[];
}

function SummaryContent() {
  const searchParams = useSearchParams();
  const [data, setData] = useState<SequenceData | null>(null);
  const [rating, setRating] = useState(0);
  const [shared, setShared] = useState(false);

  useEffect(() => {
    const d = searchParams.get("d");
    if (d) {
      try {
        const parsed = JSON.parse(atob(decodeURIComponent(d)));
        setData(parsed);
      } catch {
        // Invalid data, stay null
      }
    }
  }, [searchParams]);

  if (!data) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-bg text-muted">
        <p>No positions found. Start from the beginning.</p>
      </div>
    );
  }

  const handleShare = async () => {
    const shareUrl = window.location.href;
    const shareText = `My take on Anora — where do you land?`;

    if (navigator.share) {
      try {
        await navigator.share({ title: "Film Companion — Anora", text: shareText, url: shareUrl });
        setShared(true);
      } catch {
        // User cancelled share
      }
    } else {
      await navigator.clipboard.writeText(shareUrl);
      setShared(true);
      setTimeout(() => setShared(false), 2000);
    }
  };

  return (
    <div className="flex flex-col min-h-screen bg-bg text-text">
      <div className="w-full max-w-[430px] mx-auto flex flex-col min-h-screen px-6 py-6">
        {/* Header */}
        <p className="text-xs font-mono tracking-[0.2em] uppercase text-muted mb-8">
          Your positions
        </p>

        {/* Film card */}
        <div className="flex gap-4 mb-8">
          <div className="relative w-16 h-24 rounded-md overflow-hidden flex-shrink-0">
            <Image
              src="https://image.tmdb.org/t/p/w200/cgXk2tNYhJZLXdBDO5DidAVzQ82.jpg"
              alt="Anora"
              fill
              className="object-cover"
              sizes="64px"
            />
          </div>
          <div>
            <h1 className="text-xl font-semibold">Anora</h1>
            <p className="text-sm text-muted">Sean Baker &middot; 2024</p>
          </div>
        </div>

        {/* Star rating */}
        <div className="mb-8">
          <p className="text-sm text-muted mb-3">Your rating</p>
          <StarRating value={rating} onChange={setRating} />
        </div>

        {/* Position bars for cards 1-3 */}
        <div className="flex flex-col gap-6 mb-8">
          {ANORA_CARDS.filter((c) => c.hasSlider).map((card, idx) => {
            const position = data.positions[idx];
            const text = data.texts[idx];
            const hasPosition = position >= 0;

            return (
              <div key={card.id}>
                <div className="flex justify-between items-center mb-2">
                  <span className="text-xs font-mono tracking-[0.1em] uppercase text-accent">
                    {card.type}
                  </span>
                </div>

                {/* Spectrum bar */}
                {hasPosition && (
                  <div className="relative h-3 bg-surface rounded-full mb-2">
                    <div
                      className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-3 h-3 rounded-full bg-accent shadow-[0_0_8px_rgba(232,183,74,0.4)]"
                      style={{ left: `${position}%` }}
                    />
                  </div>
                )}

                {/* Pole labels */}
                <div className="flex justify-between">
                  <span className="text-[10px] text-muted">{card.leftPole}</span>
                  <span className="text-[10px] text-muted text-right">
                    {card.rightPole}
                  </span>
                </div>

                {/* Written text */}
                {text && (
                  <p className="text-sm text-text/70 mt-2 italic">
                    &ldquo;{text}&rdquo;
                  </p>
                )}
              </div>
            );
          })}
        </div>

        {/* Open prompt text (Card 4) */}
        {data.texts[3] && (
          <div className="mb-8 p-4 rounded-lg bg-surface">
            <p className="text-xs font-mono tracking-[0.1em] uppercase text-accent mb-2">
              Your reflection
            </p>
            <p className="text-sm text-text/80 leading-relaxed">
              {data.texts[3]}
            </p>
          </div>
        )}

        <div className="flex-1" />

        {/* CTAs */}
        <div className="flex flex-col gap-3 pb-6">
          <button
            onClick={handleShare}
            className="w-full py-4 bg-accent text-bg text-center font-semibold text-base rounded-xl transition-all hover:brightness-110 active:scale-[0.98]"
          >
            {shared ? "Link copied!" : "Share your take"}
          </button>
          <button
            className="w-full py-4 bg-surface text-text text-center font-medium text-base rounded-xl transition-all hover:bg-surface-hover active:scale-[0.98]"
            onClick={() => {
              // TODO: wire up chat with warm-start
              alert("Chat coming in Week 2 — warm-started with your positions.");
            }}
          >
            Go deeper
          </button>
        </div>
      </div>
    </div>
  );
}

export default function SummaryPage() {
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center min-h-screen bg-bg text-muted">
          Loading...
        </div>
      }
    >
      <SummaryContent />
    </Suspense>
  );
}
