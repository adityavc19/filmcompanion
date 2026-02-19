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
    <div ref={containerRef} style={{ position: 'relative', width: '100%' }}>
      <div style={{ position: 'relative' }}>
        <input
          ref={inputRef}
          autoFocus={autoFocus}
          type="text"
          value={query}
          onChange={(e) => { setQuery(e.target.value); setActiveIndex(-1); }}
          onKeyDown={handleKeyDown}
          onFocus={() => suggestions.length > 0 && setOpen(true)}
          placeholder="Search for a film..."
          style={{
            width: '100%',
            padding: '16px 48px 16px 20px',
            background: 'rgba(12,12,11,0.6)',
            backdropFilter: 'blur(16px)',
            WebkitBackdropFilter: 'blur(16px)',
            border: '1px solid rgba(255,255,255,0.12)',
            borderRadius: 12,
            color: '#F0EDE6',
            fontSize: 16,
            fontFamily: 'var(--font-dm-sans), sans-serif',
            outline: 'none',
            transition: 'border-color 0.2s',
          }}
          onFocusCapture={(e) => {
            e.currentTarget.style.borderColor = 'rgba(232,183,74,0.45)';
            if (suggestions.length > 0) setOpen(true);
          }}
          onBlurCapture={(e) => {
            e.currentTarget.style.borderColor = 'rgba(255,255,255,0.12)';
          }}
        />
        <div style={{ position: 'absolute', right: 16, top: '50%', transform: 'translateY(-50%)', color: 'rgba(255,255,255,0.3)' }}>
          {loading ? (
            <svg style={{ animation: 'spin 1s linear infinite' }} width="18" height="18" fill="none" viewBox="0 0 24 24">
              <circle style={{ opacity: 0.25 }} cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path style={{ opacity: 0.75 }} fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
          ) : (
            <svg width="18" height="18" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 21l-4.35-4.35M17 11A6 6 0 1 1 5 11a6 6 0 0 1 12 0z" />
            </svg>
          )}
        </div>
      </div>

      {open && suggestions.length > 0 && (
        <div style={{
          position: 'absolute', top: '100%', marginTop: 8, width: '100%',
          background: '#111110', border: '1px solid #1C1C1A',
          borderRadius: 12, boxShadow: '0 20px 60px rgba(0,0,0,0.7)',
          zIndex: 50, overflow: 'hidden',
        }}>
          {suggestions.map((film, i) => (
            <button
              key={film.id}
              onMouseDown={() => selectFilm(film)}
              onMouseEnter={() => setActiveIndex(i)}
              style={{
                width: '100%', display: 'flex', alignItems: 'center', gap: 12,
                padding: '10px 14px', textAlign: 'left', border: 'none', cursor: 'pointer',
                background: i === activeIndex ? 'rgba(232,183,74,0.06)' : 'transparent',
                borderBottom: i < suggestions.length - 1 ? '1px solid #1A1A18' : 'none',
                transition: 'background 0.15s',
              }}
            >
              <div style={{ width: 32, height: 48, flexShrink: 0, borderRadius: 4, overflow: 'hidden', background: '#1A1816' }}>
                {film.poster_path ? (
                  <Image
                    src={getTmdbPosterUrl(film.poster_path, 'w185')}
                    alt={film.title}
                    width={32}
                    height={48}
                    style={{ objectFit: 'cover', width: '100%', height: '100%' }}
                  />
                ) : null}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ color: '#F0EDE6', fontSize: 14, fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontFamily: 'var(--font-dm-sans), sans-serif' }}>
                  {film.title}
                </div>
                <div style={{ color: '#555', fontSize: 12, marginTop: 2, fontFamily: 'var(--font-dm-sans), sans-serif' }}>
                  {getFilmYear(film)}
                </div>
              </div>
              {film.vote_average > 0 && (
                <div style={{ color: '#E8B74A', fontSize: 12, fontWeight: 500, flexShrink: 0, fontFamily: 'var(--font-dm-sans), sans-serif' }}>
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
