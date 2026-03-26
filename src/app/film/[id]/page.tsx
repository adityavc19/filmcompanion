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

function generateChips(
  provocations: FilmProvocations | null,
  posData: PositionData | null,
  title: string
): string[] {
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
      chips.push(pos < 40 ? `Why might I think it's ${card.leftPole?.toLowerCase()}?` : pos > 60 ? `Make the case against — why might it be ${card.leftPole?.toLowerCase()}?` : "Why can't I pick a side?");
    }
    if (card.type === "THE SPECIFIC") {
      chips.push(pos > 60 ? "What did the director intend with that scene?" : "What are the competing reads of that scene?");
    }
    if (card.type === "THE CONTRARIAN") {
      chips.push(pos < 40 ? "What's the strongest counter to this criticism?" : "Steelman the contrarian take for me");
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
  const [positionsOpen, setPositionsOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Load film
  useEffect(() => {
    async function load() {
      try {
        const res = await fetch(`https://api.themoviedb.org/3/movie/${filmId}?api_key=${process.env.NEXT_PUBLIC_TMDB_API_KEY}&append_to_response=credits`);
        if (!res.ok) return;
        const d = await res.json();
        setFilm({
          title: d.title, year: d.release_date?.split("-")[0] ?? "",
          director: d.credits?.crew?.find((c: { job: string }) => c.job === "Director")?.name ?? "Unknown",
          posterPath: d.poster_path, backdropPath: d.backdrop_path,
          runtime: d.runtime, overview: d.overview, voteAverage: d.vote_average,
          genres: d.genres?.map((g: { name: string }) => g.name) ?? [],
          cast: d.credits?.cast?.slice(0, 5).map((c: { name: string }) => c.name) ?? [],
        });
      } catch { /* */ }
    }
    load();
  }, [filmId]);

  // Load positions
  useEffect(() => {
    try {
      const prov = sessionStorage.getItem(`fc_provocations_${filmId}`);
      if (prov) setProvocations(JSON.parse(prov));
      const pos = sessionStorage.getItem(`fc_positions_${filmId}`);
      if (pos) setPosData(JSON.parse(pos));
    } catch { /* */ }
    const entry = getLogEntry(Number(filmId));
    if (entry) {
      setRating(entry.rating);
      if (!posData) setPosData({ positions: entry.positions, texts: entry.texts });
    }
  }, [filmId]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const hasPositions = posData && posData.positions.some((p) => p >= 0);
  const sliderCards = provocations?.cards?.filter((c) => c.hasSlider) ?? [];
  const cardLabels = sliderCards.map((c) => ({ type: c.type, leftPole: c.leftPole, rightPole: c.rightPole }));
  const chips = generateChips(provocations, posData, film?.title ?? "this film");

  const sendMessage = useCallback(async (text: string) => {
    if (!text.trim() || isLoading) return;
    const userMsg: ChatMessage = { id: `u-${Date.now()}`, role: "user", content: text };
    const updated = [...messages, userMsg];
    setMessages(updated);
    setInput("");
    setIsLoading(true);
    track("chat_message_sent", { message_number: updated.filter((m) => m.role === "user").length, char_count: text.length });
    try {
      const res = await fetch("/api/chat", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: updated.map((m) => ({ role: m.role, content: m.content })), filmTitle: film?.title ?? "", filmYear: film?.year ?? "", positions: posData?.positions ?? [], texts: posData?.texts ?? [], cardLabels }),
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
      setMessages((prev) => [...prev, { id: `err-${Date.now()}`, role: "assistant", content: "Something went wrong." }]);
    } finally { setIsLoading(false); }
  }, [messages, isLoading, film, posData, cardLabels]);

  const handleSubmit = (e: FormEvent) => { e.preventDefault(); sendMessage(input.trim()); };

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
      {/* ===== HERO — backdrop + poster + metadata ===== */}
      <div className="relative w-full">
        {/* Backdrop */}
        {film.backdropPath && (
          <div className="absolute inset-0 h-[340px] overflow-hidden">
            <Image
              src={`https://image.tmdb.org/t/p/w1280${film.backdropPath}`}
              alt=""
              fill
              className="object-cover opacity-20 blur-sm"
              sizes="100vw"
              priority
            />
            <div className="absolute inset-0 bg-gradient-to-b from-bg/30 via-bg/70 to-bg" />
          </div>
        )}

        {/* Nav */}
        <div className="relative z-10 flex items-center justify-between px-5 pt-5 pb-3">
          <Link href="/" className="text-sm text-muted hover:text-text transition-colors">
            ← Back
          </Link>
          {hasPositions && (
            <Link href={`/film/${filmId}/sequence`} className="text-xs text-muted hover:text-accent transition-colors">
              Retake →
            </Link>
          )}
        </div>

        {/* Hero content */}
        <div className="relative z-10 w-full max-w-[430px] mx-auto px-6 pt-4 pb-8">
          <div className="flex gap-5">
            {/* Poster */}
            {film.posterPath && (
              <div className="relative w-[120px] h-[180px] rounded-lg overflow-hidden shadow-[0_8px_30px_rgba(0,0,0,0.5)] flex-shrink-0">
                <Image
                  src={`https://image.tmdb.org/t/p/w300${film.posterPath}`}
                  alt={film.title}
                  fill
                  className="object-cover"
                  sizes="120px"
                  priority
                />
              </div>
            )}

            {/* Meta */}
            <div className="flex flex-col justify-end min-w-0">
              {/* Genres */}
              {film.genres.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mb-2">
                  {film.genres.slice(0, 3).map((g) => (
                    <span key={g} className="text-[10px] px-2 py-0.5 rounded-full bg-text/10 text-muted">
                      {g}
                    </span>
                  ))}
                </div>
              )}

              <h1 className="text-2xl font-semibold tracking-tight leading-tight">
                {film.title}
              </h1>

              <p className="text-xs text-muted mt-1">
                {film.director} &middot; {film.year}
                {film.runtime ? ` · ${film.runtime}m` : ""}
              </p>

              {/* Ratings row */}
              <div className="flex items-center gap-2.5 mt-3">
                {film.voteAverage > 0 && (
                  <div className="flex items-center gap-1 text-xs">
                    <span className="text-accent font-semibold">{film.voteAverage.toFixed(1)}</span>
                    <span className="text-muted/60">TMDB</span>
                  </div>
                )}
                {rating > 0 && (
                  <div className="flex items-center gap-1 text-xs">
                    <span className="text-accent">{"★".repeat(Math.floor(rating))}{rating % 1 >= 0.5 ? "½" : ""}</span>
                    <span className="text-muted/60">You</span>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Synopsis */}
          <p className="text-sm text-text/75 leading-relaxed mt-5">
            {film.overview}
          </p>

          {/* Cast */}
          {film.cast.length > 0 && (
            <p className="text-xs text-muted/60 mt-3">
              {film.cast.join(" · ")}
            </p>
          )}
        </div>
      </div>

      {/* ===== CONTENT SECTIONS ===== */}
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
            <p className="text-xs text-muted text-center mt-2">
              4 cards &middot; 2 minutes
            </p>
          </div>
        )}

        {/* ===== THE CONVERSATION — provocation hook + sentiment ===== */}
        {provocations && (
          <section className="mb-8">
            <h2 className="text-xs font-mono tracking-[0.15em] uppercase text-muted mb-4">
              The Conversation
            </h2>

            {/* Pull-quote / hook */}
            {provocations.hookText && (
              <p className="text-base text-text/90 leading-relaxed italic border-l-2 border-accent pl-4 mb-4">
                {provocations.hookText}
              </p>
            )}

            {/* Data point */}
            {provocations.dataPoint && (
              <p className="text-xs text-muted leading-relaxed mb-4">
                {provocations.dataPoint}
              </p>
            )}
          </section>
        )}

        {/* ===== MY TAKE — collapsible positions ===== */}
        {hasPositions && sliderCards.length > 0 && (
          <section className="mb-8">
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

            {/* Expanded: full positions */}
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
                        <span className="text-[9px] text-muted">{card.leftPole}</span>
                        <span className="text-[9px] text-muted text-right">{card.rightPole}</span>
                      </div>
                      {text && <p className="text-[11px] text-text/50 mt-1 italic">&ldquo;{text}&rdquo;</p>}
                    </div>
                  );
                })}
                {posData?.texts[3] && (
                  <div className="p-3 rounded-lg bg-surface">
                    <p className="text-[11px] text-text/70 leading-relaxed">{posData.texts[3]}</p>
                  </div>
                )}
              </div>
            )}
          </section>
        )}

        {/* ===== DISCUSS THIS FILM ===== */}
        <section className="mb-10">
          <h2 className="text-xs font-mono tracking-[0.15em] uppercase text-muted mb-4">
            Discuss This Film
          </h2>

          {/* Starter chips */}
          {showStarterChips && (
            <div className="flex flex-wrap gap-2 mb-4">
              {chips.map((chip, i) => (
                <button
                  key={i}
                  onClick={() => sendMessage(chip)}
                  className="text-xs px-3 py-2 rounded-full bg-surface text-text/70 hover:bg-surface-hover hover:text-accent transition-colors text-left leading-relaxed"
                >
                  {chip}
                </button>
              ))}
            </div>
          )}

          {/* Chat messages */}
          {messages.length > 0 && (
            <div className="bg-surface rounded-xl overflow-hidden mb-3">
              <div className="max-h-[50vh] overflow-y-auto p-4 space-y-3">
                {messages.map((msg) => (
                  <div key={msg.id} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                    <div className={`max-w-[85%] rounded-2xl px-4 py-3 text-sm leading-relaxed ${
                      msg.role === "user"
                        ? "bg-accent text-bg rounded-br-sm"
                        : "bg-bg text-text rounded-bl-sm"
                    }`}>
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
            </div>
          )}

          {/* Chat input — always visible */}
          <form onSubmit={handleSubmit} className="flex gap-2">
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder={`Ask anything about ${film.title}...`}
              className="flex-1 bg-surface text-text text-sm rounded-xl px-4 py-3 placeholder:text-muted/40 focus:outline-none focus:ring-1 focus:ring-accent/30"
              disabled={isLoading}
            />
            <button
              type="submit"
              disabled={isLoading || !input.trim()}
              className="px-4 py-3 bg-accent text-bg rounded-xl text-sm font-medium disabled:opacity-30 transition-opacity"
            >
              →
            </button>
          </form>

          {/* Source attribution */}
          <div className="flex items-center gap-3 mt-3">
            <span className="text-[10px] text-muted/40">Sources:</span>
            {["TMDB", "Gemini"].map((src) => (
              <span key={src} className="text-[10px] text-muted/40">{src}</span>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
