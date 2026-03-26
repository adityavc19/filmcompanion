"use client";

import { useState, useEffect, useRef, useCallback, type FormEvent } from "react";
import { useParams } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import { type FilmProvocations } from "@/lib/cards";
import { getLogEntry } from "@/lib/journal";
import { track } from "@/lib/analytics";

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

interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
}

function generateStarterChips(
  provocations: FilmProvocations | null,
  posData: PositionData | null,
  filmTitle: string
): string[] {
  if (!provocations || !posData) {
    return [
      `What's the most divisive thing about ${filmTitle}?`,
      "What did critics and audiences disagree about?",
      "What scene stuck with you the most?",
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
          ? `Why do I think this is ${card.leftPole?.toLowerCase()}?`
          : pos > 60
          ? `Make the case against — why might it be ${card.leftPole?.toLowerCase()}?`
          : "Why can't I pick a side on the central question?"
      );
    }
    if (card.type === "THE SPECIFIC") {
      chips.push(
        pos < 40
          ? `What supports reading that scene as "${card.leftPole?.toLowerCase()}"?`
          : pos > 60
          ? "What did the director intend with that scene?"
          : "What are the competing reads of that key scene?"
      );
    }
    if (card.type === "THE CONTRARIAN") {
      chips.push(
        pos < 40
          ? "What's the strongest counter to this criticism?"
          : pos > 60
          ? "Steelman the contrarian take for me"
          : "Why is this criticism so polarizing?"
      );
    }
  });

  chips.push("What did critics and audiences disagree about most?");
  return chips.slice(0, 4);
}

export default function FilmPage() {
  const params = useParams();
  const filmId = params.id as string;

  const [film, setFilm] = useState<FilmMeta | null>(null);
  const [provocations, setProvocations] = useState<FilmProvocations | null>(null);
  const [posData, setPosData] = useState<PositionData | null>(null);
  const [rating, setRating] = useState(0);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [chatOpen, setChatOpen] = useState(false);
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
          director: d.credits?.crew?.find((c: { job: string }) => c.job === "Director")?.name ?? "Unknown",
          posterPath: d.poster_path,
          backdropPath: d.backdrop_path,
          runtime: d.runtime,
          overview: d.overview,
          voteAverage: d.vote_average,
          genres: d.genres?.map((g: { name: string }) => g.name) ?? [],
          cast: d.credits?.cast?.slice(0, 6).map((c: { name: string }) => c.name) ?? [],
        });
      } catch { /* */ }
    }
    load();
  }, [filmId]);

  // Load positions + provocations from sessionStorage / journal
  useEffect(() => {
    // Try sessionStorage first (just completed sequence)
    try {
      const provStored = sessionStorage.getItem(`fc_provocations_${filmId}`);
      if (provStored) setProvocations(JSON.parse(provStored));

      const posStored = sessionStorage.getItem(`fc_positions_${filmId}`);
      if (posStored) setPosData(JSON.parse(posStored));
    } catch { /* */ }

    // Check journal for rating
    const entry = getLogEntry(Number(filmId));
    if (entry) {
      setRating(entry.rating);
      if (!posData) {
        setPosData({ positions: entry.positions, texts: entry.texts });
      }
    }
  }, [filmId]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const hasPositions = posData && posData.positions.some((p) => p >= 0);
  const sliderCards = provocations?.cards?.filter((c) => c.hasSlider) ?? [];
  const cardLabels = sliderCards.map((c) => ({ type: c.type, leftPole: c.leftPole, rightPole: c.rightPole }));
  const chips = generateStarterChips(provocations, posData, film?.title ?? "this film");
  const showChips = chatOpen && messages.length <= 1 && !isLoading;

  const startChat = useCallback(() => {
    setChatOpen(true);
    track("go_deeper_tap", { film_id: filmId });
    const opener = hasPositions
      ? `You went through the provocation cards for ${film?.title}. Your positions tell a story. What do you want to dig into?`
      : `Let's talk about ${film?.title}. I've read the discourse — critics, Letterboxd, Reddit. What's on your mind?`;
    setMessages([{ id: "opener", role: "assistant", content: opener }]);
  }, [film, filmId, hasPositions]);

  const sendMessage = useCallback(
    async (text: string) => {
      if (!text.trim() || isLoading) return;

      const userMsg: ChatMessage = { id: `u-${Date.now()}`, role: "user", content: text };
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
            messages: updated.map((m) => ({ role: m.role, content: m.content })),
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
        setMessages((prev) => [...prev, { id: aId, role: "assistant", content: "" }]);

        const dec = new TextDecoder();
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          content += dec.decode(value, { stream: true });
          setMessages((prev) => prev.map((m) => (m.id === aId ? { ...m, content } : m)));
        }
      } catch {
        setMessages((prev) => [
          ...prev,
          { id: `err-${Date.now()}`, role: "assistant", content: "Something went wrong." },
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

  if (!film) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-bg text-muted">
        <div className="w-6 h-6 border-2 border-accent/30 border-t-accent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="flex flex-col min-h-screen bg-bg text-text">
      <div className="w-full max-w-[430px] mx-auto flex flex-col">
        {/* Poster hero */}
        <div className="relative w-full aspect-[2/3] max-h-[50vh]">
          <Image
            src={`https://image.tmdb.org/t/p/w780${film.posterPath}`}
            alt={film.title}
            fill
            className="object-cover"
            priority
            sizes="430px"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-bg via-bg/30 to-transparent" />
          {/* Back button */}
          <Link
            href="/"
            className="absolute top-5 left-5 w-8 h-8 rounded-full bg-bg/60 backdrop-blur flex items-center justify-center text-text/80 hover:text-text transition-colors z-10"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="15 18 9 12 15 6" />
            </svg>
          </Link>
        </div>

        <div className="relative -mt-28 z-10 px-6">
          {/* Title block */}
          <h1 className="text-3xl font-semibold tracking-tight leading-tight">
            {film.title}
          </h1>
          <p className="text-sm text-muted mt-1">
            {film.director} &middot; {film.year}
            {film.runtime ? ` · ${film.runtime}m` : ""}
          </p>
          {film.genres.length > 0 && (
            <p className="text-xs text-muted/60 mt-1">{film.genres.join(", ")}</p>
          )}

          {/* Rating + scores */}
          <div className="flex items-center gap-3 mt-4">
            {film.voteAverage > 0 && (
              <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-surface text-sm">
                <span className="text-accent font-medium">{film.voteAverage.toFixed(1)}</span>
                <span className="text-muted">TMDB</span>
              </span>
            )}
            {rating > 0 && (
              <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-surface text-sm">
                <span className="text-accent">{"★".repeat(Math.floor(rating))}{rating % 1 >= 0.5 ? "½" : ""}</span>
                <span className="text-muted">You</span>
              </span>
            )}
          </div>

          {/* Synopsis */}
          <p className="text-sm text-text/80 leading-relaxed mt-5">
            {film.overview}
          </p>

          {/* Cast */}
          {film.cast.length > 0 && (
            <p className="text-xs text-muted mt-3">
              {film.cast.join(", ")}
            </p>
          )}

          {/* === TAKE A POSITION CTA === */}
          {!hasPositions && (
            <Link
              href={`/film/${filmId}/sequence`}
              className="block w-full py-4 mt-6 bg-accent text-bg text-center font-semibold text-base rounded-xl transition-all hover:brightness-110 active:scale-[0.98]"
            >
              Take a position
            </Link>
          )}

          {/* === YOUR POSITIONS === */}
          {hasPositions && sliderCards.length > 0 && (
            <div className="mt-8">
              <h2 className="text-xs font-mono tracking-[0.15em] uppercase text-muted mb-4">
                Your positions
              </h2>
              <div className="flex flex-col gap-5">
                {sliderCards.map((card, idx) => {
                  const pos = posData!.positions[idx];
                  const text = posData!.texts[idx];
                  if (pos < 0) return null;

                  return (
                    <div key={card.id}>
                      <div className="flex justify-between items-center mb-1.5">
                        <span className="text-[11px] font-mono tracking-[0.1em] uppercase text-accent">
                          {card.type}
                        </span>
                      </div>
                      <div className="relative h-2 bg-surface rounded-full mb-1.5">
                        <div
                          className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-2.5 h-2.5 rounded-full bg-accent shadow-[0_0_8px_rgba(232,183,74,0.3)]"
                          style={{ left: `${pos}%` }}
                        />
                      </div>
                      <div className="flex justify-between">
                        <span className="text-[10px] text-muted">{card.leftPole}</span>
                        <span className="text-[10px] text-muted text-right">{card.rightPole}</span>
                      </div>
                      {text && (
                        <p className="text-xs text-text/60 mt-1.5 italic">&ldquo;{text}&rdquo;</p>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Retake link */}
              <Link
                href={`/film/${filmId}/sequence`}
                className="text-xs text-muted hover:text-accent mt-4 inline-block transition-colors"
              >
                Retake positions →
              </Link>
            </div>
          )}

          {/* Open prompt reflection */}
          {posData?.texts[3] && (
            <div className="mt-6 p-4 rounded-xl bg-surface">
              <p className="text-xs font-mono tracking-[0.1em] uppercase text-accent mb-2">
                Your reflection
              </p>
              <p className="text-sm text-text/80 leading-relaxed">{posData.texts[3]}</p>
            </div>
          )}

          {/* === DISCUSS SECTION === */}
          <div className="mt-8 mb-6">
            <h2 className="text-xs font-mono tracking-[0.15em] uppercase text-muted mb-4">
              Discuss
            </h2>

            {!chatOpen ? (
              <div>
                {/* Starter chips as preview */}
                <div className="flex flex-wrap gap-2 mb-4">
                  {chips.map((chip, i) => (
                    <button
                      key={i}
                      onClick={() => {
                        startChat();
                        setTimeout(() => sendMessage(chip), 100);
                      }}
                      className="text-xs px-3 py-2 rounded-full bg-surface text-text/70 hover:bg-surface-hover hover:text-accent transition-colors text-left"
                    >
                      {chip}
                    </button>
                  ))}
                </div>
                <button
                  onClick={startChat}
                  className="w-full py-3.5 bg-surface text-text text-center font-medium text-sm rounded-xl hover:bg-surface-hover transition-colors"
                >
                  Start a conversation
                </button>
              </div>
            ) : (
              <div className="flex flex-col bg-surface rounded-xl overflow-hidden">
                {/* Messages */}
                <div className="max-h-[50vh] overflow-y-auto p-4 space-y-4">
                  {messages.map((msg) => (
                    <div
                      key={msg.id}
                      className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
                    >
                      <div
                        className={`max-w-[85%] rounded-2xl px-4 py-3 text-sm leading-relaxed ${
                          msg.role === "user"
                            ? "bg-accent text-bg rounded-br-sm"
                            : "bg-bg text-text rounded-bl-sm"
                        }`}
                      >
                        {msg.content}
                      </div>
                    </div>
                  ))}
                  {isLoading && messages[messages.length - 1]?.role === "user" && (
                    <div className="flex justify-start">
                      <div className="bg-bg text-muted rounded-2xl rounded-bl-sm px-4 py-3 text-sm">
                        <span className="animate-pulse">Thinking...</span>
                      </div>
                    </div>
                  )}
                  <div ref={messagesEndRef} />
                </div>

                {/* Starter chips inside chat */}
                {showChips && (
                  <div className="px-4 pb-2 flex flex-wrap gap-2">
                    {chips.map((chip, i) => (
                      <button
                        key={i}
                        onClick={() => sendMessage(chip)}
                        className="text-xs px-3 py-1.5 rounded-full bg-bg text-text/70 hover:text-accent transition-colors text-left"
                      >
                        {chip}
                      </button>
                    ))}
                  </div>
                )}

                {/* Input */}
                <form onSubmit={handleSubmit} className="flex gap-2 p-3 border-t border-text/5">
                  <input
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    placeholder={`Ask about ${film.title}...`}
                    className="flex-1 bg-bg text-text text-sm rounded-lg px-4 py-3 placeholder:text-muted/50 focus:outline-none focus:ring-1 focus:ring-accent/30"
                    disabled={isLoading}
                  />
                  <button
                    type="submit"
                    disabled={isLoading || !input.trim()}
                    className="px-4 py-3 bg-accent text-bg rounded-lg text-sm font-medium disabled:opacity-40 transition-opacity"
                  >
                    →
                  </button>
                </form>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
