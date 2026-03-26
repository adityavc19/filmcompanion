"use client";

export interface LogEntry {
  filmId: number;
  title: string;
  year: string;
  posterPath: string | null;
  director: string;
  positions: number[];
  texts: string[];
  rating: number;
  loggedAt: string; // ISO string
}

const STORAGE_KEY = "fc_journal";

export function getJournal(): LogEntry[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function logFilm(entry: LogEntry): void {
  const journal = getJournal();
  // Remove existing entry for same film (re-log)
  const filtered = journal.filter((e) => e.filmId !== entry.filmId);
  filtered.unshift(entry); // Most recent first
  localStorage.setItem(STORAGE_KEY, JSON.stringify(filtered));
}

export function getLogEntry(filmId: number): LogEntry | null {
  return getJournal().find((e) => e.filmId === filmId) ?? null;
}
