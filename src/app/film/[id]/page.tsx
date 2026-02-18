'use client';

import { useState, useCallback, useEffect } from 'react';
import { useParams } from 'next/navigation';
import Image from 'next/image';
import LoadingScreen from '@/components/LoadingScreen';
import FilmHeader from '@/components/FilmHeader';
import SentimentSection from '@/components/SentimentSection';
import ChatInterface from '@/components/ChatInterface';
import SearchBar from '@/components/SearchBar';
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

  const [phase, setPhase] = useState<'loading' | 'ready'>('loading');
  const [metadata, setMetadata] = useState<FilmMetadata | null>(null);
  const [basicFilm, setBasicFilm] = useState<TmdbFilm | null>(null);

  // Fetch basic TMDB data for loading screen
  useEffect(() => {
    fetch(`/api/film/${filmId}/metadata`)
      .then((r) => r.json())
      .then((data) => {
        if (data.tmdbData) setBasicFilm(data.tmdbData);
      })
      .catch(() => {});
  }, [filmId]);

  const handleReady = useCallback(async () => {
    try {
      const res = await fetch(`/api/film/${filmId}/metadata`);
      if (res.ok) {
        const data: FilmMetadata = await res.json();
        setMetadata(data);
        setBasicFilm(data.tmdbData);
      }
    } catch {
      // Proceed anyway
    }
    setPhase('ready');
  }, [filmId]);

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
    <div className="min-h-screen">
      {/* Backdrop */}
      {film.backdrop_path && (
        <div className="fixed inset-0 z-0 pointer-events-none">
          <Image
            src={`https://image.tmdb.org/t/p/w1280${film.backdrop_path}`}
            alt=""
            fill
            className="object-cover opacity-10 blur-2xl scale-110"
          />
          <div className="absolute inset-0 bg-gradient-to-b from-cinema-bg/60 via-cinema-bg/80 to-cinema-bg" />
        </div>
      )}

      <div className="relative z-10">
        {/* Nav */}
        <div className="border-b border-cinema-border/40 bg-cinema-bg/80 backdrop-blur sticky top-0 z-20">
          <div className="max-w-4xl mx-auto px-4 py-3 flex items-center gap-4">
            <a href="/" className="text-cinema-accent font-display text-lg font-semibold flex-shrink-0">
              Film Companion
            </a>
            <div className="flex-1 max-w-md">
              <SearchBar />
            </div>
          </div>
        </div>

        {/* Main content */}
        <div className="max-w-4xl mx-auto px-4 py-8 space-y-8">
          {/* Film header */}
          <FilmHeader
            film={film}
            letterboxdRating={metadata?.sentiment.letterboxdRating}
            tomatometer={metadata?.sentiment.tomatometer}
          />

          {/* Sentiment */}
          {metadata?.sentiment && (
            <SentimentSection sentiment={metadata.sentiment} />
          )}

          {/* Chat */}
          <div className="bg-cinema-surface border border-cinema-border rounded-xl p-5">
            <ChatInterface
              filmId={filmId}
              starterChips={metadata?.starterChips ?? []}
            />
          </div>

          {/* Sources footer */}
          {metadata && metadata.sourcesLoaded.length > 0 && (
            <p className="text-cinema-muted/50 text-xs text-center">
              Sources: {metadata.sourcesLoaded
                .filter((s) => s !== 'tmdb')
                .map((s) => {
                  const labels: Record<string, string> = {
                    letterboxd: 'Letterboxd',
                    reddit: 'Reddit',
                    rottentomatoes: 'Rotten Tomatoes',
                    youtube: 'YouTube',
                  };
                  return labels[s] ?? s;
                })
                .join(' · ')}
              {' '}· {metadata.chunkCount} knowledge chunks
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
