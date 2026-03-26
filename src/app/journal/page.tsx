"use client";

import { useState, useEffect } from "react";
import Image from "next/image";
import Link from "next/link";
import { getJournal, type LogEntry } from "@/lib/journal";

export default function JournalPage() {
  const [journal, setJournal] = useState<LogEntry[]>([]);

  useEffect(() => {
    setJournal(getJournal());
  }, []);

  return (
    <div className="flex flex-col min-h-screen bg-bg text-text">
      <div className="w-full max-w-[430px] mx-auto flex flex-col min-h-screen px-6 py-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-xl font-semibold">Journal</h1>
            <p className="text-xs text-muted mt-1">
              {journal.length} film{journal.length !== 1 ? "s" : ""} logged
            </p>
          </div>
          <Link
            href="/"
            className="text-sm text-muted hover:text-accent transition-colors"
          >
            ← Search
          </Link>
        </div>

        {journal.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center text-center gap-4">
            <p className="text-muted text-sm leading-relaxed max-w-[280px]">
              No films logged yet. Search for a film, take positions on the
              provocation cards, and rate it to log it here.
            </p>
            <Link
              href="/"
              className="text-sm text-accent hover:underline"
            >
              Search for a film →
            </Link>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {journal.map((entry) => (
              <Link
                key={entry.filmId}
                href={`/film/${entry.filmId}`}
                className="flex items-center gap-4 p-4 rounded-xl bg-surface hover:bg-surface-hover transition-colors"
              >
                <div className="relative w-12 h-18 rounded-md overflow-hidden flex-shrink-0">
                  {entry.posterPath && (
                    <Image
                      src={`https://image.tmdb.org/t/p/w92${entry.posterPath}`}
                      alt={entry.title}
                      fill
                      className="object-cover"
                      sizes="48px"
                    />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{entry.title}</p>
                  <p className="text-xs text-muted">
                    {entry.director} &middot; {entry.year}
                  </p>
                  {/* Show strongest position */}
                  {entry.positions.some((p) => p >= 0) && (
                    <div className="flex gap-1 mt-2">
                      {entry.positions
                        .slice(0, 3)
                        .map((pos, i) =>
                          pos >= 0 ? (
                            <div
                              key={i}
                              className="h-1 w-8 bg-surface-hover rounded-full relative"
                            >
                              <div
                                className="absolute top-0 w-1.5 h-1 rounded-full bg-accent"
                                style={{ left: `${(pos / 100) * 100}%` }}
                              />
                            </div>
                          ) : null
                        )}
                    </div>
                  )}
                </div>
                <div className="flex-shrink-0 text-right">
                  {entry.rating > 0 && (
                    <p className="text-sm text-accent">
                      {"★".repeat(Math.floor(entry.rating))}
                      {entry.rating % 1 >= 0.5 ? "½" : ""}
                    </p>
                  )}
                  <p className="text-[10px] text-muted mt-1">
                    {new Date(entry.loggedAt).toLocaleDateString()}
                  </p>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
