"use client";

import { useState, useEffect, useMemo, useRef, Suspense } from "react";
import { useSearchParams, useParams } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import StarRating from "@/components/StarRating";
import { type FilmProvocations } from "@/lib/cards";
import { logFilm } from "@/lib/journal";
import { track } from "@/lib/analytics";
import { encodeShareData, decodePayload } from "@/lib/share";

interface SummaryData {
  positions: number[];
  texts: string[];
}

function SummaryContent() {
  const searchParams = useSearchParams();
  const params = useParams();
  const filmId = params.id as string;

  // Derive `data` from the URL — no effect needed. searchParams is reactive.
  const data = useMemo<SummaryData | null>(() => {
    const d = searchParams.get("d");
    return d ? decodePayload<SummaryData>(d) : null;
  }, [searchParams]);

  // Read provocations from sessionStorage once at mount. SSR returns null;
  // hydration runs the initializer on the client. filmId is stable for the
  // lifetime of this route.
  const [provocations] = useState<FilmProvocations | null>(() => {
    if (typeof window === "undefined") return null;
    try {
      const stored = sessionStorage.getItem(`fc_provocations_${filmId}`);
      return stored ? (JSON.parse(stored) as FilmProvocations) : null;
    } catch {
      return null;
    }
  });

  const [rating, setRating] = useState(0);
  const [shared, setShared] = useState(false);
  const [logged, setLogged] = useState(false);
  const [filmMeta, setFilmMeta] = useState<{
    title: string;
    year: string;
    director: string;
    posterPath: string | null;
  } | null>(null);

  // Track summary_view exactly once when data is first available.
  const viewTrackedRef = useRef(false);
  useEffect(() => {
    if (data && !viewTrackedRef.current) {
      viewTrackedRef.current = true;
      track("summary_view");
    }
  }, [data]);

  // Fetch film metadata via server route (TMDB key stays server-side)
  useEffect(() => {
    let cancelled = false;
    async function loadFilm() {
      try {
        const res = await fetch(`/api/film/${filmId}`);
        if (!res.ok || cancelled) return;
        const film = await res.json();
        if (cancelled) return;
        setFilmMeta({
          title: film.title,
          year: film.year,
          director: film.director,
          posterPath: film.posterPath,
        });
      } catch {
        // Fallback
      }
    }
    loadFilm();
    return () => {
      cancelled = true;
    };
  }, [filmId]);

  // Logging happens in the rating change handler below — not in an effect —
  // so we update the external journal store synchronously with the user
  // action that caused it.
  const handleRatingChange = (value: number) => {
    setRating(value);
    if (value > 0 && filmMeta && data && !logged) {
      logFilm({
        filmId: Number(filmId),
        title: filmMeta.title,
        year: filmMeta.year,
        posterPath: filmMeta.posterPath,
        director: filmMeta.director,
        positions: data.positions,
        texts: data.texts,
        rating: value,
        loggedAt: new Date().toISOString(),
      });
      setLogged(true);
      track("rating_set", { rating_value: value });
    }
  };

  if (!data) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-bg text-muted">
        <p>No positions found.</p>
      </div>
    );
  }

  const cards = provocations?.cards?.filter((c) => c.hasSlider) ?? [];

  const handleShare = async () => {
    const sharePayload = encodeShareData({
      positions: data.positions,
      texts: data.texts,
      rating,
      filmTitle: filmMeta?.title,
    });
    // sharePayload is base64url-safe — no further URL encoding needed
    const shareUrl = `${window.location.origin}/s/${sharePayload}`;
    const shareText = `My take on ${filmMeta?.title ?? "this film"} — where do you land?`;

    if (navigator.share) {
      try {
        await navigator.share({
          title: `Film Companion — ${filmMeta?.title}`,
          text: shareText,
          url: shareUrl,
        });
        track("share_complete", { share_method: "native" });
        setShared(true);
      } catch { /* cancelled */ }
    } else {
      await navigator.clipboard.writeText(shareUrl);
      track("share_complete", { share_method: "copy_link" });
      setShared(true);
      setTimeout(() => setShared(false), 2000);
    }
  };

  return (
    <div className="flex flex-col min-h-screen bg-bg text-text">
      <div className="w-full max-w-[430px] mx-auto flex flex-col px-6 py-6">
        {/* Header */}
        <p className="text-xs font-mono tracking-[0.2em] uppercase text-muted mb-8">
          Your positions
        </p>

        {/* Film card */}
        <div className="flex gap-4 mb-8">
          {filmMeta?.posterPath && (
            <div className="relative w-16 h-24 rounded-md overflow-hidden flex-shrink-0">
              <Image
                src={`https://image.tmdb.org/t/p/w200${filmMeta.posterPath}`}
                alt={filmMeta?.title ?? "Film"}
                fill
                className="object-cover"
                sizes="64px"
              />
            </div>
          )}
          <div>
            <h1 className="text-xl font-semibold">
              {filmMeta?.title ?? "Film"}
            </h1>
            <p className="text-sm text-muted">
              {filmMeta?.director} &middot; {filmMeta?.year}
            </p>
            {logged && (
              <p className="text-xs text-accent mt-1">✓ Logged to journal</p>
            )}
          </div>
        </div>

        {/* Star rating */}
        <div className="mb-8">
          <p className="text-sm text-muted mb-3">Your rating</p>
          <StarRating value={rating} onChange={handleRatingChange} />
        </div>

        {/* Position bars */}
        <div className="flex flex-col gap-6 mb-8">
          {cards.map((card, idx) => {
            const position = data.positions[idx];
            const text = data.texts[idx];
            const hasPosition = position >= 0;

            return (
              <div key={card.id}>
                <span className="text-xs font-mono tracking-[0.1em] uppercase text-accent mb-2 block">
                  {card.type}
                </span>
                {hasPosition && (
                  <div className="relative h-3 bg-surface rounded-full mb-2">
                    <div
                      className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-3 h-3 rounded-full bg-accent shadow-[0_0_8px_rgba(232,183,74,0.4)]"
                      style={{ left: `${position}%` }}
                    />
                  </div>
                )}
                <div className="flex justify-between">
                  <span className="text-[10px] text-muted">
                    {card.leftPole}
                  </span>
                  <span className="text-[10px] text-muted text-right">
                    {card.rightPole}
                  </span>
                </div>
                {text && (
                  <p className="text-sm text-text/70 mt-2 italic">
                    &ldquo;{text}&rdquo;
                  </p>
                )}
              </div>
            );
          })}
        </div>

        {/* Open prompt */}
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

        {/* CTAs */}
        <div className="flex flex-col gap-3 mb-6">
          <button
            onClick={handleShare}
            className="w-full py-4 bg-accent text-bg text-center font-semibold text-base rounded-xl transition-all hover:brightness-110 active:scale-[0.98]"
          >
            {shared ? "Link copied!" : "Share your take"}
          </button>

          <Link
            href={`/film/${filmId}`}
            className="block w-full py-4 bg-surface text-text text-center font-medium text-base rounded-xl transition-all hover:bg-surface-hover active:scale-[0.98]"
          >
            Go to film page →
          </Link>
        </div>

        {/* Nav */}
        <div className="flex justify-between pt-4 pb-6">
          <Link href="/" className="text-sm text-muted hover:text-accent">
            ← Home
          </Link>
          <Link
            href="/journal"
            className="text-sm text-muted hover:text-accent"
          >
            Journal →
          </Link>
        </div>
      </div>
    </div>
  );
}

export default function FilmSummaryPage() {
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
