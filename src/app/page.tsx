"use client";

import { useState, useEffect, useCallback } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { getJournal, type LogEntry } from "@/lib/journal";

interface SearchResult {
  id: number;
  title: string;
  release_date: string;
  poster_path: string | null;
  vote_average: number;
}

// Curated quick-starts — films that generate great provocations
const QUICK_PICKS = [
  { id: 1064213, title: "Anora", year: "2024", poster: "/cgXk2tNYhJZLXdBDO5DidAVzQ82.jpg" },
  { id: 872585, title: "Oppenheimer", year: "2023", poster: "/8Gxv8gSFCU0XGDykEGv7zR1n2ua.jpg" },
  { id: 496243, title: "Parasite", year: "2019", poster: "/7IiTTgloJzvGI1TAYymCfbfl3vT.jpg" },
  { id: 569094, title: "Spider-Verse", year: "2023", poster: "/8Vt6mWEReuy4Of61Lnj5Xj704m8.jpg" },
  { id: 438631, title: "Dune", year: "2021", poster: "/d5NXSklXo0qyIYkgV94XAgMIckC.jpg" },
  { id: 346698, title: "Barbie", year: "2023", poster: "/iuFNMS8U5cb6xfzi51Dbkovj7vM.jpg" },
];

const TRENDING_SEARCHES = [
  "The Brutalist",
  "Conclave",
  "The Substance",
  "Nosferatu",
  "Interstellar",
  "Past Lives",
];

export default function Home() {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [journal, setJournal] = useState<LogEntry[]>([]);

  useEffect(() => {
    setJournal(getJournal());
  }, []);

  const search = useCallback(async (q: string) => {
    if (q.length < 2) {
      setResults([]);
      return;
    }
    setSearching(true);
    try {
      const res = await fetch(`/api/search?q=${encodeURIComponent(q)}`);
      const data = await res.json();
      setResults(data);
    } catch {
      setResults([]);
    } finally {
      setSearching(false);
    }
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => search(query), 300);
    return () => clearTimeout(timer);
  }, [query, search]);

  const isSearching = query.length >= 2;

  return (
    <div className="flex flex-col min-h-screen bg-bg text-text">
      <div className="w-full max-w-[430px] mx-auto flex flex-col min-h-screen px-6 py-6">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-2xl font-semibold tracking-tight">
            Film Companion
          </h1>
          <p className="text-sm text-muted mt-1">
            A film journal that argues back.
          </p>
        </div>

        {/* Search */}
        <div className="relative mb-5">
          <div className="absolute left-4 top-1/2 -translate-y-1/2 text-muted/50">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="11" cy="11" r="8" />
              <line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
          </div>
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="What did you just watch?"
            className="w-full bg-surface text-text rounded-xl pl-11 pr-4 py-3.5 text-sm placeholder:text-muted/50 focus:outline-none focus:ring-1 focus:ring-accent/30"
          />
          {searching && (
            <div className="absolute right-4 top-1/2 -translate-y-1/2">
              <div className="w-4 h-4 border-2 border-accent/40 border-t-accent rounded-full animate-spin" />
            </div>
          )}
          {query.length > 0 && !searching && (
            <button
              onClick={() => { setQuery(""); setResults([]); }}
              className="absolute right-4 top-1/2 -translate-y-1/2 text-muted/50 hover:text-text text-xs"
            >
              ✕
            </button>
          )}
        </div>

        {/* Search results */}
        {results.length > 0 && (
          <div className="flex flex-col gap-1 mb-6 bg-surface/50 rounded-xl p-2">
            {results.map((film) => (
              <button
                key={film.id}
                onClick={() => {
                  setQuery("");
                  setResults([]);
                  router.push(`/film/${film.id}`);
                }}
                className="flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-surface transition-colors text-left"
              >
                <div className="relative w-8 h-12 rounded overflow-hidden flex-shrink-0 bg-surface">
                  {film.poster_path && (
                    <Image
                      src={`https://image.tmdb.org/t/p/w92${film.poster_path}`}
                      alt={film.title}
                      fill
                      className="object-cover"
                      sizes="32px"
                    />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{film.title}</p>
                  <p className="text-xs text-muted">
                    {film.release_date?.split("-")[0]}
                    {film.vote_average > 0 && (
                      <> &middot; {film.vote_average.toFixed(1)}</>
                    )}
                  </p>
                </div>
                <span className="text-xs text-accent">→</span>
              </button>
            ))}
          </div>
        )}

        {/* --- Everything below hides during search --- */}
        {!isSearching && (
          <>
            {/* Quick picks */}
            <div className="mb-8">
              <h2 className="text-xs font-mono tracking-[0.15em] uppercase text-muted mb-3">
                Jump in
              </h2>
              <div className="grid grid-cols-3 gap-2.5">
                {QUICK_PICKS.map((film) => (
                  <Link
                    key={film.id}
                    href={`/film/${film.id}`}
                    className="group relative aspect-[2/3] rounded-lg overflow-hidden bg-surface"
                  >
                    <Image
                      src={`https://image.tmdb.org/t/p/w300${film.poster}`}
                      alt={film.title}
                      fill
                      className="object-cover transition-transform group-hover:scale-105"
                      sizes="130px"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-bg/80 via-transparent to-transparent" />
                    <div className="absolute bottom-0 left-0 right-0 p-2">
                      <p className="text-[11px] font-medium leading-tight truncate">
                        {film.title}
                      </p>
                      <p className="text-[10px] text-muted">{film.year}</p>
                    </div>
                  </Link>
                ))}
              </div>
            </div>

            {/* Trending searches */}
            <div className="mb-8">
              <h2 className="text-xs font-mono tracking-[0.15em] uppercase text-muted mb-3">
                People are arguing about
              </h2>
              <div className="flex flex-wrap gap-2">
                {TRENDING_SEARCHES.map((title) => (
                  <button
                    key={title}
                    onClick={() => setQuery(title)}
                    className="px-3 py-1.5 rounded-full bg-surface text-xs text-text/80 hover:bg-surface-hover hover:text-accent transition-colors"
                  >
                    {title}
                  </button>
                ))}
              </div>
            </div>

            {/* Journal */}
            {journal.length > 0 && (
              <div className="mb-8">
                <div className="flex justify-between items-center mb-3">
                  <h2 className="text-xs font-mono tracking-[0.15em] uppercase text-muted">
                    Your journal
                  </h2>
                  <Link
                    href="/journal"
                    className="text-xs text-accent hover:underline"
                  >
                    {journal.length} film{journal.length !== 1 ? "s" : ""} →
                  </Link>
                </div>
                <div className="flex flex-col gap-2">
                  {journal.slice(0, 4).map((entry) => (
                    <Link
                      key={entry.filmId}
                      href={`/film/${entry.filmId}`}
                      className="flex items-center gap-3 p-3 rounded-xl bg-surface hover:bg-surface-hover transition-colors"
                    >
                      <div className="relative w-10 h-[60px] rounded-md overflow-hidden flex-shrink-0">
                        {entry.posterPath && (
                          <Image
                            src={`https://image.tmdb.org/t/p/w92${entry.posterPath}`}
                            alt={entry.title}
                            fill
                            className="object-cover"
                            sizes="40px"
                          />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">
                          {entry.title}
                        </p>
                        <p className="text-xs text-muted">
                          {entry.director} &middot; {entry.year}
                        </p>
                      </div>
                      <div className="flex-shrink-0 text-right">
                        {entry.rating > 0 && (
                          <p className="text-sm text-accent leading-tight">
                            {"★".repeat(Math.floor(entry.rating))}
                            {entry.rating % 1 >= 0.5 ? "½" : ""}
                          </p>
                        )}
                        <p className="text-[10px] text-muted">
                          {new Date(entry.loggedAt).toLocaleDateString(
                            undefined,
                            { month: "short", day: "numeric" }
                          )}
                        </p>
                      </div>
                    </Link>
                  ))}
                </div>
              </div>
            )}

            {/* How it works — only show when journal is empty */}
            {journal.length === 0 && (
              <div className="mb-8">
                <h2 className="text-xs font-mono tracking-[0.15em] uppercase text-muted mb-3">
                  How it works
                </h2>
                <div className="flex flex-col gap-3">
                  {[
                    { step: "1", text: "Pick a film you just watched" },
                    { step: "2", text: "React to 4 provocation cards" },
                    { step: "3", text: "Rate it, log it to your journal" },
                    { step: "4", text: "Go deeper in conversation" },
                  ].map((item) => (
                    <div
                      key={item.step}
                      className="flex items-center gap-3"
                    >
                      <span className="w-6 h-6 rounded-full bg-surface flex items-center justify-center text-[11px] font-mono text-accent">
                        {item.step}
                      </span>
                      <span className="text-sm text-text/70">{item.text}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Bottom nav */}
            <div className="mt-auto pt-4 pb-2 flex justify-around border-t border-text/5">
              <span className="flex flex-col items-center gap-1 text-accent">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="11" cy="11" r="8" />
                  <line x1="21" y1="21" x2="16.65" y2="16.65" />
                </svg>
                <span className="text-[10px]">Discover</span>
              </span>
              <Link
                href="/journal"
                className="flex flex-col items-center gap-1 text-muted hover:text-accent transition-colors"
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
                  <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
                </svg>
                <span className="text-[10px]">Journal</span>
              </Link>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
