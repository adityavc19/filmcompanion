"use client";

import { useState, useEffect, useRef, useCallback, type FormEvent } from "react";
import { useParams } from "next/navigation";
import Image from "next/image";
import Link from "next/link";
import { type FilmProvocations } from "@/lib/cards";
import { track } from "@/lib/analytics";

interface FilmMeta {
  title: string;
  year: string;
  director: string;
  posterPath: string | null;
  runtime: number | null;
  overview: string;
  voteAverage: number;
  genres: string[];
  cast: string[];
}

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
}

interface PositionData {
  positions: number[];
  texts: string[];
}

function generateStarterChips(
  provocations: FilmProvocations | null,
  posData: PositionData | null
): string[] {
  if (!provocations || !posData) {
    return [
      "What did you think of the ending?",
      "What's the most divisive thing about this film?",
      "How does this compare to the director's other work?",
    ];
  }

  const chips: string[] = [];
  const cards = provocations.cards?.filter((c) => c.hasSlider) ?? [];

  cards.forEach((card, i) => {
    const pos = posData.positions[i];
    if (pos < 0) return;

    if (card.type === "THE TAKE") {
      if (pos < 40) {
        chips.push(`Why do I think this film is ${card.leftPole?.toLowerCase()}?`);
      } else if (pos > 60) {
        chips.push(`Make the case against my position that it ${card.rightPole?.toLowerCase()}`);
      } else {
        chips.push("Why can't I pick a side on the central question?");
      }
    }

    if (card.type === "THE SPECIFIC") {
      chips.push(
        pos < 40
          ? `What supports my reading of that scene as "${card.leftPole?.toLowerCase()}"?`
          : pos > 60
          ? `What did the director intend with that scene?`
          : "What are the competing readings of that key scene?"
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

  // Always add a general one
  chips.push("What did critics and audiences disagree about most?");

  return chips.slice(0, 4);
}

export default function DiscussPage() {
  const params = useParams();
  const filmId = params.id as string;

  const [film, setFilm] = useState<FilmMeta | null>(null);
  const [provocations, setProvocations] = useState<FilmProvocations | null>(null);
  const [posData, setPosData] = useState<PositionData | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Load film metadata
  useEffect(() => {
    async function loadFilm() {
      try {
        const res = await fetch(
          `https://api.themoviedb.org/3/movie/${filmId}?api_key=${process.env.NEXT_PUBLIC_TMDB_API_KEY}&append_to_response=credits`
        );
        if (!res.ok) return;
        const data = await res.json();
        setFilm({
          title: data.title,
          year: data.release_date?.split("-")[0] ?? "",
          director:
            data.credits?.crew?.find(
              (c: { job: string }) => c.job === "Director"
            )?.name ?? "Unknown",
          posterPath: data.poster_path,
          runtime: data.runtime,
          overview: data.overview,
          voteAverage: data.vote_average,
          genres: data.genres?.map((g: { name: string }) => g.name) ?? [],
          cast:
            data.credits?.cast
              ?.slice(0, 6)
              .map((c: { name: string }) => c.name) ?? [],
        });
      } catch {
        // Fallback
      }
    }
    loadFilm();
  }, [filmId]);

  // Load provocations + positions from sessionStorage
  useEffect(() => {
    try {
      const provStored = sessionStorage.getItem(`fc_provocations_${filmId}`);
      if (provStored) setProvocations(JSON.parse(provStored));

      const posStored = sessionStorage.getItem(`fc_positions_${filmId}`);
      if (posStored) setPosData(JSON.parse(posStored));
    } catch {
      // No cached data
    }
  }, [filmId]);

  // Generate opener once film + positions are loaded
  useEffect(() => {
    if (messages.length > 0 || !film) return;

    let opener: string;
    if (posData && posData.positions.some((p) => p >= 0)) {
      opener = `You just went through the provocation cards for ${film.title}. Your positions tell an interesting story. What do you want to dig into?`;
    } else {
      opener = `Let's talk about ${film.title}. I've read the discourse — critics, Letterboxd, Reddit threads. What's on your mind?`;
    }

    setMessages([{ id: "opener", role: "assistant", content: opener }]);
    track("discuss_view", { film_id: filmId });
  }, [film, posData, messages.length, filmId]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const cardLabels =
    provocations?.cards
      ?.filter((c) => c.hasSlider)
      .map((c) => ({
        type: c.type,
        leftPole: c.leftPole,
        rightPole: c.rightPole,
      })) ?? [];

  const starterChips = generateStarterChips(provocations, posData);

  const sendMessage = useCallback(
    async (userMessage: string) => {
      const userMsg: Message = {
        id: `user-${Date.now()}`,
        role: "user",
        content: userMessage,
      };

      const updatedMessages = [...messages, userMsg];
      setMessages(updatedMessages);
      setInput("");
      setIsLoading(true);

      track("chat_message_sent", {
        message_number: updatedMessages.filter((m) => m.role === "user").length,
        char_count: userMessage.length,
      });

      try {
        const res = await fetch("/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            messages: updatedMessages.map((m) => ({
              role: m.role,
              content: m.content,
            })),
            filmTitle: film?.title ?? "this film",
            filmYear: film?.year ?? "",
            positions: posData?.positions ?? [],
            texts: posData?.texts ?? [],
            cardLabels,
          }),
        });

        if (!res.ok) throw new Error(`Chat failed: ${res.status}`);

        const reader = res.body?.getReader();
        if (!reader) throw new Error("No body");

        const assistantId = `assistant-${Date.now()}`;
        let content = "";

        setMessages((prev) => [
          ...prev,
          { id: assistantId, role: "assistant", content: "" },
        ]);

        const decoder = new TextDecoder();
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          content += decoder.decode(value, { stream: true });
          setMessages((prev) =>
            prev.map((m) => (m.id === assistantId ? { ...m, content } : m))
          );
        }
      } catch (err) {
        console.error("Chat error:", err);
        setMessages((prev) => [
          ...prev,
          {
            id: `error-${Date.now()}`,
            role: "assistant",
            content: "Something went wrong. Check that the Gemini API key is set.",
          },
        ]);
      } finally {
        setIsLoading(false);
      }
    },
    [messages, film, posData, cardLabels]
  );

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;
    sendMessage(input.trim());
  };

  const showChips =
    messages.length <= 1 && !isLoading;

  return (
    <div className="flex flex-col min-h-screen bg-bg text-text">
      <div className="w-full max-w-[430px] mx-auto flex flex-col min-h-screen">
        {/* Film header */}
        <div className="flex items-start gap-4 px-6 pt-6 pb-4">
          {film?.posterPath && (
            <div className="relative w-14 h-21 rounded-md overflow-hidden flex-shrink-0">
              <Image
                src={`https://image.tmdb.org/t/p/w200${film.posterPath}`}
                alt={film?.title ?? "Film"}
                fill
                className="object-cover"
                sizes="56px"
              />
            </div>
          )}
          <div className="flex-1 min-w-0">
            <Link
              href={`/film/${filmId}`}
              className="text-lg font-semibold hover:text-accent transition-colors truncate block"
            >
              {film?.title ?? "Loading..."}
            </Link>
            <p className="text-xs text-muted">
              {film?.director} &middot; {film?.year}
              {film?.runtime ? ` · ${film.runtime}m` : ""}
            </p>
            {film?.genres && film.genres.length > 0 && (
              <p className="text-[10px] text-muted/60 mt-0.5">
                {film.genres.join(", ")}
              </p>
            )}
          </div>
        </div>

        {/* Position summary bar (if they did the cards) */}
        {posData && posData.positions.some((p) => p >= 0) && (
          <div className="flex gap-3 px-6 pb-4">
            {posData.positions.slice(0, 3).map((pos, i) =>
              pos >= 0 ? (
                <div key={i} className="flex-1">
                  <div className="relative h-1.5 bg-surface rounded-full">
                    <div
                      className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-2 h-2 rounded-full bg-accent"
                      style={{ left: `${pos}%` }}
                    />
                  </div>
                </div>
              ) : (
                <div key={i} className="flex-1 h-1.5 bg-surface/30 rounded-full" />
              )
            )}
          </div>
        )}

        <div className="h-px bg-text/5 mx-6" />

        {/* Chat messages */}
        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
          {messages.map((msg) => (
            <div
              key={msg.id}
              className={`flex ${
                msg.role === "user" ? "justify-end" : "justify-start"
              }`}
            >
              <div
                className={`max-w-[85%] rounded-2xl px-4 py-3 text-sm leading-relaxed ${
                  msg.role === "user"
                    ? "bg-accent text-bg rounded-br-sm"
                    : "bg-surface text-text rounded-bl-sm"
                }`}
              >
                {msg.content}
              </div>
            </div>
          ))}

          {isLoading && messages[messages.length - 1]?.role === "user" && (
            <div className="flex justify-start">
              <div className="bg-surface text-muted rounded-2xl rounded-bl-sm px-4 py-3 text-sm">
                <span className="animate-pulse">Thinking...</span>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Starter chips */}
        {showChips && (
          <div className="px-6 pb-3 flex flex-wrap gap-2">
            {starterChips.map((chip, i) => (
              <button
                key={i}
                onClick={() => sendMessage(chip)}
                className="text-xs px-3 py-2 rounded-full bg-surface text-text/80 hover:bg-surface-hover hover:text-accent transition-colors text-left"
              >
                {chip}
              </button>
            ))}
          </div>
        )}

        {/* Input */}
        <form
          onSubmit={handleSubmit}
          className="flex gap-2 px-6 py-4 border-t border-text/5"
        >
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={`Ask anything about ${film?.title ?? "this film"}...`}
            className="flex-1 bg-surface text-text text-sm rounded-xl px-4 py-3 placeholder:text-muted/50 focus:outline-none focus:ring-1 focus:ring-accent/30"
            disabled={isLoading}
          />
          <button
            type="submit"
            disabled={isLoading || !input.trim()}
            className="px-4 py-3 bg-accent text-bg rounded-xl text-sm font-medium disabled:opacity-40 transition-opacity"
          >
            →
          </button>
        </form>
      </div>
    </div>
  );
}
