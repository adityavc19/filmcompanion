'use client';

import { useState, useCallback, useEffect } from 'react';
import { useParams } from 'next/navigation';
import Image from 'next/image';
import Link from 'next/link';
import LoadingScreen from '@/components/LoadingScreen';
import FilmHeader from '@/components/FilmHeader';
import SentimentSection from '@/components/SentimentSection';
import ChatInterface from '@/components/ChatInterface';
import type { TmdbFilm, SentimentSummary } from '@/types';

interface FilmMetadata {
  filmId: number;
  tmdbData: TmdbFilm;
  sentiment: SentimentSummary;
  starterChips: string[];
  sourcesLoaded: string[];
  chunkCount: number;
}

export default function FilmPage() {
  const params = useParams();
  const filmId = parseInt(params.id as string, 10);

  const [phase, setPhase] = useState<'checking' | 'loading' | 'ready'>('checking');
  const [metadata, setMetadata] = useState<FilmMetadata | null>(null);
  const [basicFilm, setBasicFilm] = useState<TmdbFilm | null>(null);

  // On mount, check if metadata is already cached (L1 or L2) — skip loader if so
  useEffect(() => {
    fetch(`/api/film/${filmId}/metadata`)
      .then((r) => { if (!r.ok) throw new Error(); return r.json(); })
      .then((data: FilmMetadata) => {
        if (data.tmdbData && data.sourcesLoaded?.includes('tmdb')) {
          // Film already fully cached — skip loader entirely
          setMetadata(data);
          setBasicFilm(data.tmdbData);
          setPhase('ready');
        } else {
          // Partial or no data — show loader
          if (data.tmdbData) setBasicFilm(data.tmdbData);
          setPhase('loading');
        }
      })
      .catch(() => setPhase('loading'));
  }, [filmId]);

  const handleReady = useCallback(async () => {
    try {
      const res = await fetch(`/api/film/${filmId}/metadata`);
      if (res.ok) {
        const data: FilmMetadata = await res.json();
        setMetadata(data);
        setBasicFilm(data.tmdbData);
      }
    } catch { /* Proceed anyway */ }
    setPhase('ready');
  }, [filmId]);

  if (phase === 'checking') {
    return (
      <div style={{ minHeight: '100vh', background: '#0C0C0B', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ width: 24, height: 24, border: '2px solid #E8B74A', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
      </div>
    );
  }

  if (phase === 'loading') {
    return (
      <LoadingScreen
        filmId={filmId}
        filmTitle={basicFilm?.title ?? 'Loading...'}
        posterPath={basicFilm?.poster_path ?? null}
        backdropPath={basicFilm?.backdrop_path ?? null}
        onReady={handleReady}
      />
    );
  }

  const film = metadata?.tmdbData ?? basicFilm;
  if (!film) return null;

  return (
    <div style={{ minHeight: '100vh', background: '#0C0C0B', color: '#F0EDE6' }}>
      {/* Subtle blurred backdrop */}
      {film.backdrop_path && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 0, pointerEvents: 'none' }}>
          <Image
            src={`https://image.tmdb.org/t/p/w1280${film.backdrop_path}`}
            alt=""
            fill
            style={{ objectFit: 'cover', opacity: 0.05, filter: 'blur(24px)', transform: 'scale(1.1)' }}
          />
          <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to bottom, rgba(12,12,11,0.5), #0C0C0B)' }} />
        </div>
      )}

      <div style={{ position: 'relative', zIndex: 10 }}>
        {/* Nav */}
        <nav
          style={{
            position: 'fixed', top: 0, left: 0, right: 0, zIndex: 100,
            padding: '14px 28px',
            display: 'flex', alignItems: 'center', gap: 32,
            background: 'linear-gradient(to bottom, #0C0C0B 70%, transparent)',
            backdropFilter: 'blur(12px)',
          }}
        >
          <Link href="/" style={{ display: 'flex', alignItems: 'center', gap: 10, textDecoration: 'none' }}>
            <div style={{ width: 7, height: 7, borderRadius: '50%', background: '#E8B74A' }} />
            <span style={{ fontSize: 13, fontWeight: 500, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#999' }}>
              Film Companion
            </span>
          </Link>
          <Link
            href="/"
            style={{
              display: 'flex', alignItems: 'center', gap: 8, textDecoration: 'none',
              background: '#111110', border: '1px solid #1C1C1A', borderRadius: 8, padding: '9px 28px',
            }}
          >
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
              <circle cx="7" cy="7" r="5.5" stroke="#555" strokeWidth="1.2" />
              <path d="M11 11l3.5 3.5" stroke="#555" strokeWidth="1.2" strokeLinecap="round" />
            </svg>
            <span style={{ fontSize: 13, color: '#555' }}>Search films</span>
          </Link>
        </nav>

        {/* Hero area */}
        <div style={{ position: 'relative', paddingTop: 72 }}>
          {/* Subtle radial warm glow behind the hero */}
          <div
            style={{
              position: 'absolute', top: 0, left: 0, right: 0, height: 380,
              background: 'radial-gradient(ellipse at 30% 20%, #1A1912 0%, #0C0C0B 70%)',
              opacity: 0.8, pointerEvents: 'none',
            }}
          />
          <div style={{ position: 'relative', maxWidth: 860, margin: '0 auto', padding: '36px 28px 0' }}>
            <FilmHeader
              film={film}
              letterboxdRating={metadata?.sentiment.letterboxdRating}
              tomatometer={metadata?.sentiment.tomatometer}
            />
          </div>
        </div>

        {/* Content */}
        <div style={{ maxWidth: 860, margin: '0 auto', padding: '0 28px' }}>
          {/* Divider */}
          <div style={{ height: 1, background: '#171715', marginTop: 40 }} />

          {/* What People Think */}
          {metadata?.sentiment && (
            <div style={{ paddingTop: 36 }}>
              <SentimentSection
                sentiment={metadata.sentiment}
                sourcesLoaded={metadata.sourcesLoaded}
                chunkCount={metadata.chunkCount}
              />
            </div>
          )}

          {/* Discuss */}
          <ChatInterface
            filmId={filmId}
            filmTitle={film.title}
            starterChips={metadata?.starterChips ?? []}
          />
        </div>
      </div>
    </div>
  );
}
