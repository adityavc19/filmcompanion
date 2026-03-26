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

  return (
    <div className="flex flex-col min-h-screen bg-bg text-text">
      <div className="w-full max-w-[430px] mx-auto flex flex-col min-h-screen px-6 py-6">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-2xl font-semibold tracking-tight">
            Film Companion
          </h1>
          <p className="text-sm text-muted mt-1">
            A film journal that argues back.
          </p>
        </div>

        {/* Search */}
        <div className="relative mb-6">
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search for a film..."
            className="w-full bg-surface text-text rounded-xl px-4 py-3.5 text-sm placeholder:text-muted/50 focus:outline-none focus:ring-1 focus:ring-accent/30"
          />
          {searching && (
            <div className="absolute right-4 top-1/2 -translate-y-1/2">
              <div className="w-4 h-4 border-2 border-accent/40 border-t-accent rounded-full animate-spin" />
            </div>
          )}
        </div>

        {/* Search results */}
        {results.length > 0 && (
          <div className="flex flex-col gap-1 mb-8">
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
                      <> &middot; {film.vote_average.toFixed(1)}/10</>
                    )}
                  </p>
                </div>
              </button>
            ))}
          </div>
        )}

        {/* Journal — recent logs */}
        {query.length < 2 && journal.length > 0 && (
          <div>
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-sm font-mono tracking-[0.1em] uppercase text-muted">
                Your journal
              </h2>
              {journal.length > 3 && (
                <Link
                  href="/journal"
                  className="text-xs text-accent hover:underline"
                >
                  See all →
                </Link>
              )}
            </div>
            <div className="flex flex-col gap-3">
              {journal.slice(0, 5).map((entry) => (
                <Link
                  key={entry.filmId}
                  href={`/film/${entry.filmId}`}
                  className="flex items-center gap-3 p-3 rounded-lg bg-surface hover:bg-surface-hover transition-colors"
                >
                  <div className="relative w-10 h-15 rounded overflow-hidden flex-shrink-0">
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
                      {entry.year} &middot; {entry.director}
                    </p>
                  </div>
                  <div className="flex-shrink-0 text-right">
                    {entry.rating > 0 && (
                      <p className="text-sm text-accent">
                        {"★".repeat(Math.floor(entry.rating))}
                        {entry.rating % 1 >= 0.5 ? "½" : ""}
                      </p>
                    )}
                    <p className="text-[10px] text-muted">
                      {new Date(entry.loggedAt).toLocaleDateString()}
                    </p>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        )}

        {/* Empty state */}
        {query.length < 2 && journal.length === 0 && (
          <div className="flex-1 flex flex-col items-center justify-center text-center gap-4 py-16">
            <p className="text-muted text-sm leading-relaxed max-w-[280px]">
              Search for a film you&apos;ve watched. Take a position on 4
              provocation cards. Log it. Build your journal.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
