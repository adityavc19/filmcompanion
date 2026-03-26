"use client";

import { useState, useEffect, useRef, useCallback, type FormEvent } from "react";
import { useParams } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import { type FilmProvocations } from "@/lib/cards";
import { getLogEntry } from "@/lib/journal";
import { track } from "@/lib/analytics";

/* ──────────────────── Types ──────────────────── */

interface FilmMeta {
  title: string;
  year: string;
  director: string;
  posterPath: string | null;
  backdropPath: string | null;
  runtime: number | null;
  overview: string;
  voteAverage: number;
  genres: string[];
  cast: string[];
}

interface PositionData {
  positions: number[];
  texts: string[];
}

interface Discourse {
  critics: string;
  audiences: string;
  tension: string;
  letterboxdRating?: string;
  tomatometer?: string;
  audienceScore?: string;
  sourcesUsed?: string[];
  starterChips?: string[];
}

interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
}

/* ──────────────────── Helpers ──────────────────── */

const SOURCE_META: Record<string, { icon: string; name: string; color: string }> = {
  letterboxd: { icon: "📗", name: "Letterboxd", color: "#00E054" },
  rottentomatoes: { icon: "🍅", name: "Rotten Tomatoes", color: "#FA320A" },
  reddit: { icon: "💬", name: "Reddit", color: "#FF6B35" },
  youtube: { icon: "▶", name: "YouTube", color: "#FF0000" },
};

function parseRating(s: string): number | null {
  const m = s.match(/(\d+\.?\d*)/);
  if (!m) return null;
  const n = parseFloat(m[1]);
  return isNaN(n) ? null : n;
}

function LBStars({ rating }: { rating: number }) {
  return (
    <div className="flex gap-[2px] items-center">
      {Array.from({ length: 5 }, (_, i) => {
        const fill = Math.min(1, Math.max(0, rating - i));
        const pct = `${fill * 100}%`;
        const id = `sf-${i}-${Math.round(rating * 10)}`;
        return (
          <svg key={i} width="13" height="13" viewBox="0 0 20 20">
            <defs>
              <linearGradient id={id}>
                <stop offset={pct} stopColor="#E8B74A" />
                <stop offset={pct} stopColor="#3A3A3A" />
              </linearGradient>
            </defs>
            <path
              d="M10 1l2.39 4.84 5.34.78-3.87 3.77.91 5.32L10 13.27l-4.77 2.51.91-5.32L2.27 6.7l5.34-.78L10 1z"
              fill={`url(#${id})`}
            />
          </svg>
        );
      })}
    </div>
  );
}

function generateChips(
  discourse: Discourse | null,
  provocations: FilmProvocations | null,
  posData: PositionData | null,
  title: string
): string[] {
  // If we have discourse starter chips, use those first
  if (discourse?.starterChips?.length) {
    return discourse.starterChips.slice(0, 4);
  }
  // Fall back to position-derived chips
  if (!provocations || !posData) {
    return [
      `What's the most divisive thing about ${title}?`,
      "What did critics and audiences disagree about?",
      "What scene generated the most discussion?",
      "How does this compare to the director's other work?",
    ];
  }
  const chips: string[] = [];
  const cards = provocations.cards?.filter((c) => c.hasSlider) ?? [];
  cards.forEach((card, i) => {
    const pos = posData.positions[i];
    if (pos < 0) return;
    if (card.type === "THE TAKE") {
      chips.push(
        pos < 40
          ? `Why might I think it's ${card.leftPole?.toLowerCase()}?`
          : pos > 60
          ? `Make the case against — why might it be ${card.leftPole?.toLowerCase()}?`
          : "Why can't I pick a side?"
      );
    }
    if (card.type === "THE SPECIFIC") {
      chips.push(
        pos > 60
          ? "What did the director intend with that scene?"
          : "What are the competing reads of that scene?"
      );
    }
    if (card.type === "THE CONTRARIAN") {
      chips.push(
        pos < 40
          ? "What's the strongest counter to this criticism?"
          : "Steelman the contrarian take for me"
      );
    }
  });
  chips.push("What did critics and audiences disagree about most?");
  return chips.slice(0, 4);
}

/* ──────────────────── Component ──────────────────── */

export default function FilmPage() {
  const params = useParams();
  const filmId = params.id as string;

  const [film, setFilm] = useState<FilmMeta | null>(null);
  const [discourse, setDiscourse] = useState<Discourse | null>(null);
  const [discourseLoading, setDiscourseLoading] = useState(false);
  const [provocations, setProvocations] = useState<FilmProvocations | null>(null);
  const [posData, setPosData] = useState<PositionData | null>(null);
  const [rating, setRating] = useState(0);
  const [positionsOpen, setPositionsOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Load film metadata
  useEffect(() => {
    async function load() {
      try {
        const res = await fetch(
          `https://api.themoviedb.org/3/movie/${filmId}?api_key=${process.env.NEXT_PUBLIC_TMDB_API_KEY}&append_to_response=credits`
        );
        if (!res.ok) return;
        const d = await res.json();
        setFilm({
          title: d.title,
          year: d.release_date?.split("-")[0] ?? "",
          director:
            d.credits?.crew?.find((c: { job: string }) => c.job === "Director")
              ?.name ?? "Unknown",
          posterPath: d.poster_path,
          backdropPath: d.backdrop_path,
          runtime: d.runtime,
          overview: d.overview,
          voteAverage: d.vote_average,
          genres: d.genres?.map((g: { name: string }) => g.name) ?? [],
          cast:
            d.credits?.cast
              ?.slice(0, 5)
              .map((c: { name: string }) => c.name) ?? [],
        });
      } catch {
        /* */
      }
    }
    load();
  }, [filmId]);

  // Load discourse synthesis
  useEffect(() => {
    async function loadDiscourse() {
      setDiscourseLoading(true);
      try {
        const res = await fetch(`/api/discourse?filmId=${filmId}`);
        if (res.ok) {
          const data = await res.json();
          setDiscourse(data);
        }
      } catch {
        /* */
      } finally {
        setDiscourseLoading(false);
      }
    }
    loadDiscourse();
  }, [filmId]);

  // Load positions & provocations from session
  useEffect(() => {
    try {
      const prov = sessionStorage.getItem(`fc_provocations_${filmId}`);
      if (prov) setProvocations(JSON.parse(prov));
      const pos = sessionStorage.getItem(`fc_positions_${filmId}`);
      if (pos) setPosData(JSON.parse(pos));
    } catch {
      /* */
    }
    const entry = getLogEntry(Number(filmId));
    if (entry) {
      setRating(entry.rating);
      if (!posData)
        setPosData({ positions: entry.positions, texts: entry.texts });
    }
  }, [filmId]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const hasPositions = posData && posData.positions.some((p) => p >= 0);
  const sliderCards =
    provocations?.cards?.filter((c) => c.hasSlider) ?? [];
  const cardLabels = sliderCards.map((c) => ({
    type: c.type,
    leftPole: c.leftPole,
    rightPole: c.rightPole,
  }));
  const chips = generateChips(
    discourse,
    provocations,
    posData,
    film?.title ?? "this film"
  );

  const lbRating = discourse?.letterboxdRating
    ? parseRating(discourse.letterboxdRating)
    : null;

  // Chat
  const sendMessage = useCallback(
    async (text: string) => {
      if (!text.trim() || isLoading) return;
      const userMsg: ChatMessage = {
        id: `u-${Date.now()}`,
        role: "user",
        content: text,
      };
      const updated = [...messages, userMsg];
      setMessages(updated);
      setInput("");
      setIsLoading(true);
      track("chat_message_sent", {
        message_number: updated.filter((m) => m.role === "user").length,
        char_count: text.length,
      });
      try {
        const res = await fetch("/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            messages: updated.map((m) => ({
              role: m.role,
              content: m.content,
            })),
            filmTitle: film?.title ?? "",
            filmYear: film?.year ?? "",
            positions: posData?.positions ?? [],
            texts: posData?.texts ?? [],
            cardLabels,
          }),
        });
        if (!res.ok) throw new Error("failed");
        const reader = res.body?.getReader();
        if (!reader) throw new Error("no body");
        const aId = `a-${Date.now()}`;
        let content = "";
        setMessages((prev) => [
          ...prev,
          { id: aId, role: "assistant", content: "" },
        ]);
        const dec = new TextDecoder();
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          content += dec.decode(value, { stream: true });
          setMessages((prev) =>
            prev.map((m) => (m.id === aId ? { ...m, content } : m))
          );
        }
      } catch {
        setMessages((prev) => [
          ...prev,
          {
            id: `err-${Date.now()}`,
            role: "assistant",
            content: "Something went wrong.",
          },
        ]);
      } finally {
        setIsLoading(false);
      }
    },
    [messages, isLoading, film, posData, cardLabels]
  );

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    sendMessage(input.trim());
  };

  // Loading
  if (!film) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-bg text-muted">
        <div className="w-6 h-6 border-2 border-accent/30 border-t-accent rounded-full animate-spin" />
      </div>
    );
  }

  const showStarterChips = messages.length === 0 && !isLoading;

  return (
    <div className="flex flex-col min-h-screen bg-bg text-text">
      {/* ═══════ CINEMATIC HERO ═══════ */}
      <div className="relative w-full">
        {/* Backdrop */}
        {film.backdropPath && (
          <div className="absolute inset-0 h-[380px] overflow-hidden">
            <Image
              src={`https://image.tmdb.org/t/p/w1280${film.backdropPath}`}
              alt=""
              fill
              className="object-cover opacity-25"
              style={{ objectPosition: "center 20%" }}
              sizes="100vw"
              priority
            />
            <div className="absolute inset-0 bg-gradient-to-b from-bg/40 via-bg/70 to-bg" />
            <div className="absolute inset-0 bg-gradient-to-r from-bg/80 via-bg/30 to-transparent" />
          </div>
        )}

        {/* Nav */}
        <nav className="relative z-20 flex items-center justify-between px-5 pt-5 pb-2">
          <Link
            href="/"
            className="flex items-center gap-2 text-sm text-muted hover:text-text transition-colors"
          >
            <span className="w-[6px] h-[6px] rounded-full bg-accent" />
            <span className="text-[11px] font-medium tracking-[0.1em] uppercase text-muted/70">
              Film Companion
            </span>
          </Link>
          {hasPositions && (
            <Link
              href={`/film/${filmId}/sequence`}
              className="text-[11px] text-muted/60 hover:text-accent transition-colors"
            >
              Retake positions →
            </Link>
          )}
        </nav>

        {/* Hero content — poster + metadata */}
        <div className="relative z-10 w-full max-w-[430px] mx-auto px-6 pt-6 pb-8">
          <div className="flex gap-5">
            {/* Poster */}
            {film.posterPath && (
              <div className="relative w-[130px] h-[195px] rounded-lg overflow-hidden shadow-[0_8px_32px_rgba(0,0,0,0.5),0_24px_64px_rgba(0,0,0,0.4)] flex-shrink-0 border border-white/[0.06]">
                <Image
                  src={`https://image.tmdb.org/t/p/w300${film.posterPath}`}
                  alt={film.title}
                  fill
                  className="object-cover"
                  sizes="130px"
                  priority
                />
              </div>
            )}

            {/* Meta */}
            <div className="flex flex-col justify-end min-w-0">
              {/* Genre pills */}
              {film.genres.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mb-2.5">
                  {film.genres.slice(0, 3).map((g) => (
                    <span
                      key={g}
                      className="text-[9px] font-semibold tracking-[0.08em] uppercase px-2 py-[3px] rounded-full bg-white/[0.06] text-muted/70 border border-white/[0.04]"
                    >
                      {g}
                    </span>
                  ))}
                </div>
              )}

              {/* Title */}
              <h1 className="text-[28px] font-semibold tracking-tight leading-[1.05]">
                {film.title}
              </h1>

              {/* Director · Year · Runtime */}
              <p className="text-[13px] text-muted mt-1.5">
                <span className="text-text/80">{film.director}</span>
                <span className="text-muted/40"> · </span>
                {film.year}
                {film.runtime ? (
                  <>
                    <span className="text-muted/40"> · </span>
                    {film.runtime}m
                  </>
                ) : null}
              </p>

              {/* Ratings row */}
              <div className="flex items-center gap-3 mt-3 flex-wrap">
                {film.voteAverage > 0 && (
                  <div className="flex flex-col items-center gap-[2px]">
                    <span className="text-[9px] font-semibold tracking-[0.1em] uppercase text-muted/50">
                      TMDB
                    </span>
                    <span className="text-[18px] font-medium text-text leading-none">
                      {film.voteAverage.toFixed(1)}
                    </span>
                  </div>
                )}
                {discourse?.tomatometer && (
                  <div className="flex flex-col items-center gap-[2px]">
                    <span className="text-[9px] font-semibold tracking-[0.1em] uppercase text-muted/50">
                      Tomatometer
                    </span>
                    <span className="text-[18px] font-medium text-text leading-none">
                      🍅{discourse.tomatometer}
                    </span>
                  </div>
                )}
                {lbRating !== null && (
                  <div className="flex flex-col items-center gap-[2px]">
                    <span className="text-[9px] font-semibold tracking-[0.1em] uppercase text-muted/50">
                      Letterboxd
                    </span>
                    <LBStars rating={lbRating} />
                  </div>
                )}
                {rating > 0 && (
                  <div className="flex flex-col items-center gap-[2px]">
                    <span className="text-[9px] font-semibold tracking-[0.1em] uppercase text-muted/50">
                      You
                    </span>
                    <span className="text-[18px] font-medium text-accent leading-none">
                      {"★".repeat(Math.floor(rating))}
                      {rating % 1 >= 0.5 ? "½" : ""}
                    </span>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Synopsis */}
          <p className="text-sm text-text/70 leading-relaxed mt-5">
            {film.overview}
          </p>

          {/* Cast */}
          {film.cast.length > 0 && (
            <p className="text-xs text-muted/50 mt-2.5">{film.cast.join(" · ")}</p>
          )}
        </div>
      </div>

      {/* ═══════ CONTENT SECTIONS ═══════ */}
      <div className="w-full max-w-[430px] mx-auto px-6">
        {/* Take a position CTA (if no positions yet) */}
        {!hasPositions && (
          <div className="mb-8">
            <Link
              href={`/film/${filmId}/sequence`}
              className="block w-full py-4 bg-accent text-bg text-center font-semibold text-base rounded-xl transition-all hover:brightness-110 active:scale-[0.98]"
            >
              Take a position
            </Link>
            <p className="text-[11px] text-muted text-center mt-2">
              4 cards &middot; 2 minutes
            </p>
          </div>
        )}

        {/* ═══════ THE CONVERSATION — discourse synthesis ═══════ */}
        <section className="mb-10">
          <h2 className="text-[22px] font-semibold tracking-tight mb-1.5">
            The Conversation
          </h2>
          <p className="text-xs text-muted/60 mb-6">
            What critics and audiences are saying
          </p>

          {discourseLoading && !discourse && (
            <div className="flex items-center gap-3 py-8">
              <div className="w-4 h-4 border-2 border-accent/30 border-t-accent rounded-full animate-spin" />
              <span className="text-sm text-muted">
                Gathering perspectives...
              </span>
            </div>
          )}

          {discourse && (
            <>
              {/* Tension pull-quote */}
              {discourse.tension && (
                <div className="py-6 border-y border-white/[0.06] mb-6 text-center">
                  <p className="text-[15px] italic leading-relaxed text-text/80 max-w-[360px] mx-auto">
                    &ldquo;{discourse.tension}&rdquo;
                  </p>
                </div>
              )}

              {/* Critics */}
              {discourse.critics && (
                <div className="mb-5">
                  <div className="flex items-center gap-2.5 mb-2.5">
                    <div className="w-[3px] h-4 rounded bg-[#00C030]" />
                    <span className="text-[10px] font-semibold tracking-[0.1em] uppercase text-[#00C030]">
                      Critics
                    </span>
                  </div>
                  <p className="text-[13px] leading-[1.75] text-text/60">
                    {discourse.critics}
                  </p>
                </div>
              )}

              {/* Audiences */}
              {discourse.audiences && (
                <div className="mb-5">
                  <div className="flex items-center gap-2.5 mb-2.5">
                    <div className="w-[3px] h-4 rounded bg-[#FF6B35]" />
                    <span className="text-[10px] font-semibold tracking-[0.1em] uppercase text-[#FF6B35]">
                      Audiences
                    </span>
                  </div>
                  <p className="text-[13px] leading-[1.75] text-text/60">
                    {discourse.audiences}
                  </p>
                </div>
              )}

              {/* Sources */}
              {discourse.sourcesUsed && discourse.sourcesUsed.length > 0 && (
                <div className="flex items-center gap-3 flex-wrap pt-4 border-t border-white/[0.06]">
                  <span className="text-[10px] text-muted/40">
                    Synthesized from
                  </span>
                  {discourse.sourcesUsed.map((src) => {
                    const meta = SOURCE_META[src];
                    if (!meta) return null;
                    return (
                      <span
                        key={src}
                        className="inline-flex items-center gap-1.5 text-[10px] text-muted/60"
                      >
                        <span className="text-[11px] opacity-70">
                          {meta.icon}
                        </span>
                        {meta.name}
                      </span>
                    );
                  })}
                </div>
              )}
            </>
          )}
        </section>

        {/* ═══════ MY TAKE — collapsible positions ═══════ */}
        {hasPositions && sliderCards.length > 0 && (
          <section className="mb-10">
            <button
              onClick={() => setPositionsOpen(!positionsOpen)}
              className="flex items-center justify-between w-full mb-3"
            >
              <h2 className="text-xs font-mono tracking-[0.15em] uppercase text-muted">
                My Take
              </h2>
              <span className="text-xs text-muted/60">
                {positionsOpen ? "−" : "+"}
              </span>
            </button>

            {/* Collapsed: mini spectrum bars */}
            {!positionsOpen && (
              <div className="flex gap-2">
                {sliderCards.map((card, idx) => {
                  const pos = posData!.positions[idx];
                  if (pos < 0) return null;
                  return (
                    <div key={card.id} className="flex-1">
                      <div className="relative h-1.5 bg-surface rounded-full">
                        <div
                          className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-2 h-2 rounded-full bg-accent"
                          style={{ left: `${pos}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Expanded */}
            {positionsOpen && (
              <div className="flex flex-col gap-4">
                {sliderCards.map((card, idx) => {
                  const pos = posData!.positions[idx];
                  const text = posData!.texts[idx];
                  if (pos < 0) return null;
                  return (
                    <div key={card.id}>
                      <span className="text-[10px] font-mono tracking-[0.1em] uppercase text-accent mb-1 block">
                        {card.type}
                      </span>
                      <div className="relative h-2 bg-surface rounded-full mb-1">
                        <div
                          className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-2.5 h-2.5 rounded-full bg-accent shadow-[0_0_6px_rgba(232,183,74,0.3)]"
                          style={{ left: `${pos}%` }}
                        />
                      </div>
                      <div className="flex justify-between">
                        <span className="text-[9px] text-muted">
                          {card.leftPole}
                        </span>
                        <span className="text-[9px] text-muted text-right">
                          {card.rightPole}
                        </span>
                      </div>
                      {text && (
                        <p className="text-[11px] text-text/50 mt-1 italic">
                          &ldquo;{text}&rdquo;
                        </p>
                      )}
                    </div>
                  );
                })}
                {posData?.texts[3] && (
                  <div className="p-3 rounded-lg bg-surface">
                    <p className="text-[11px] text-text/70 leading-relaxed">
                      {posData.texts[3]}
                    </p>
                  </div>
                )}
              </div>
            )}
          </section>
        )}

        {/* ═══════ DISCUSS THIS FILM ═══════ */}
        <section className="mb-10">
          {/* Section header */}
          <div className="flex items-center gap-3 mb-4">
            <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-accent/20 to-accent/5 border border-accent/20 flex items-center justify-center text-[11px]">
              ✦
            </div>
            <h2 className="text-lg font-semibold">
              Discuss{" "}
              <span className="italic text-text/60">{film.title}</span>
            </h2>
            {messages.length > 0 && (
              <button
                onClick={() => setMessages([])}
                className="ml-auto text-[10px] text-muted/40 hover:text-muted transition-colors"
              >
                Clear
              </button>
            )}
          </div>

          {/* Starter chips */}
          {showStarterChips && (
            <div className="mb-4">
              <p className="text-xs text-muted/50 mb-3">
                Ask anything about the film.
              </p>
              <div className="grid grid-cols-2 gap-2">
                {chips.map((chip, i) => (
                  <button
                    key={i}
                    onClick={() => sendMessage(chip)}
                    className="text-[12px] px-3 py-3 rounded-xl bg-surface text-text/60 hover:bg-surface-hover hover:text-accent hover:border-accent/20 border border-white/[0.04] transition-all text-left leading-relaxed"
                  >
                    {chip}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Chat messages */}
          {messages.length > 0 && (
            <div className="flex flex-col gap-5 mb-4">
              {messages.map((msg, i) => {
                const isUser = msg.role === "user";
                const isLast = i === messages.length - 1;
                const isEmpty =
                  msg.content === "" && isLoading && isLast && !isUser;

                return (
                  <div key={msg.id} className="flex flex-col gap-1.5">
                    {/* Label */}
                    {!isUser && (
                      <div className="flex items-center gap-2 mb-0.5">
                        <div className="w-5 h-5 rounded-md bg-gradient-to-br from-accent/15 to-accent/5 border border-accent/15 flex items-center justify-center text-[9px]">
                          ✦
                        </div>
                        <span className="text-[10px] font-semibold tracking-[0.06em] uppercase text-muted/60">
                          Companion
                        </span>
                      </div>
                    )}

                    {/* Message */}
                    {isEmpty ? (
                      <div className="flex gap-1 pl-7 py-2">
                        {[0, 1, 2].map((j) => (
                          <div
                            key={j}
                            className="w-1.5 h-1.5 rounded-full bg-accent/40 animate-pulse"
                            style={{ animationDelay: `${j * 150}ms` }}
                          />
                        ))}
                      </div>
                    ) : (
                      <div
                        className={
                          isUser
                            ? "self-end max-w-[80%] px-4 py-3 bg-surface rounded-[14px] rounded-br-[4px] border border-white/[0.06]"
                            : "pl-7 w-full"
                        }
                      >
                        <p
                          className={`text-[13px] leading-[1.75] whitespace-pre-wrap ${
                            isUser ? "text-text" : "text-text/70"
                          }`}
                        >
                          {msg.content}
                          {isLoading && isLast && !isUser && msg.content && (
                            <span className="inline-block w-1.5 h-4 bg-accent/50 ml-0.5 align-middle animate-pulse" />
                          )}
                        </p>
                      </div>
                    )}
                  </div>
                );
              })}
              <div ref={messagesEndRef} />
            </div>
          )}

          {/* Input */}
          <form
            onSubmit={handleSubmit}
            className="flex items-end gap-2.5 p-3 bg-surface rounded-2xl border border-white/[0.04]"
          >
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder={`Ask about ${film.title}...`}
              className="flex-1 bg-transparent text-text text-sm py-2 px-1 placeholder:text-muted/30 focus:outline-none"
              disabled={isLoading}
            />
            <button
              type="submit"
              disabled={isLoading || !input.trim()}
              className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 transition-all disabled:opacity-20"
              style={{
                background:
                  input.trim() && !isLoading ? "#E8B74A" : "#1A1A18",
              }}
            >
              <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
                <path
                  d="M3 8h10M9 4l4 4-4 4"
                  stroke={input.trim() && !isLoading ? "#0D0D0C" : "#444"}
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </button>
          </form>

          {/* Source attribution */}
          <div className="flex items-center gap-3 mt-3">
            <span className="text-[10px] text-muted/30">Powered by</span>
            <span className="text-[10px] text-muted/30">TMDB</span>
            <span className="text-[10px] text-muted/30">·</span>
            <span className="text-[10px] text-muted/30">Gemini</span>
          </div>
        </section>
      </div>
    </div>
  );
}
