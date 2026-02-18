'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import type { TmdbSearchResult } from '@/types';
import { getTmdbPosterUrl, getFilmYear } from '@/lib/tmdb';

export default function SearchBar({ autoFocus = false }: { autoFocus?: boolean }) {
  const [query, setQuery] = useState('');
  const [suggestions, setSuggestions] = useState<TmdbSearchResult[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const router = useRouter();
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const fetchSuggestions = useCallback(async (q: string) => {
    if (q.length < 2) { setSuggestions([]); setOpen(false); return; }
    setLoading(true);
    try {
      const res = await fetch(`/api/search?q=${encodeURIComponent(q)}`);
      const data: TmdbSearchResult[] = await res.json();
      setSuggestions(data);
      setOpen(data.length > 0);
    } catch {
      setSuggestions([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => fetchSuggestions(query), 300);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [query, fetchSuggestions]);

  // Close on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const selectFilm = (film: TmdbSearchResult) => {
    setOpen(false);
    setQuery('');
    router.push(`/film/${film.id}`);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!open) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveIndex((i) => Math.min(i + 1, suggestions.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIndex((i) => Math.max(i - 1, -1));
    } else if (e.key === 'Enter' && activeIndex >= 0) {
      e.preventDefault();
      selectFilm(suggestions[activeIndex]);
    } else if (e.key === 'Escape') {
      setOpen(false);
    }
  };

  return (
    <div ref={containerRef} className="relative w-full max-w-2xl mx-auto">
      <div className="relative">
        <input
          ref={inputRef}
          autoFocus={autoFocus}
          type="text"
          value={query}
          onChange={(e) => { setQuery(e.target.value); setActiveIndex(-1); }}
          onKeyDown={handleKeyDown}
          onFocus={() => suggestions.length > 0 && setOpen(true)}
          placeholder="Search for a film..."
          className="w-full px-5 py-4 bg-cinema-surface border border-cinema-border rounded-xl text-white placeholder-cinema-muted text-lg focus:outline-none focus:border-cinema-accent/60 focus:ring-1 focus:ring-cinema-accent/30 transition-all"
        />
        <div className="absolute right-4 top-1/2 -translate-y-1/2 text-cinema-muted">
          {loading ? (
            <svg className="animate-spin h-5 w-5" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
          ) : (
            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-4.35-4.35M17 11A6 6 0 1 1 5 11a6 6 0 0 1 12 0z" />
            </svg>
          )}
        </div>
      </div>

      {open && suggestions.length > 0 && (
        <div className="absolute top-full mt-2 w-full bg-cinema-surface border border-cinema-border rounded-xl shadow-2xl z-50 overflow-hidden">
          {suggestions.map((film, i) => (
            <button
              key={film.id}
              className={`w-full flex items-center gap-3 px-4 py-3 text-left transition-colors ${
                i === activeIndex ? 'bg-cinema-accent/10' : 'hover:bg-white/5'
              } ${i < suggestions.length - 1 ? 'border-b border-cinema-border' : ''}`}
              onMouseDown={() => selectFilm(film)}
              onMouseEnter={() => setActiveIndex(i)}
            >
              <div className="w-8 h-12 flex-shrink-0 rounded overflow-hidden bg-cinema-border">
                {film.poster_path ? (
                  <Image
                    src={getTmdbPosterUrl(film.poster_path, 'w185')}
                    alt={film.title}
                    width={32}
                    height={48}
                    className="object-cover w-full h-full"
                  />
                ) : (
                  <div className="w-full h-full bg-cinema-border" />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-white font-medium truncate">{film.title}</div>
                <div className="text-cinema-muted text-sm">{getFilmYear(film)}</div>
              </div>
              {film.vote_average > 0 && (
                <div className="text-cinema-accent text-sm font-medium flex-shrink-0">
                  ★ {film.vote_average.toFixed(1)}
                </div>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
