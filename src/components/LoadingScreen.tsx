'use client';

import { useEffect, useState } from 'react';
import Image from 'next/image';
import type { IngestProgressEvent, SourceName } from '@/types';
import { getTmdbPosterUrl } from '@/lib/tmdb';

const SOURCE_LABELS: Record<SourceName, string> = {
  tmdb: 'Film details',
  letterboxd: 'Letterboxd reviews',
  reddit: 'Reddit discussions',
  rottentomatoes: 'Critic reviews',
  youtube: 'Video essays',
};

const SOURCE_ORDER: SourceName[] = ['tmdb', 'letterboxd', 'reddit', 'rottentomatoes', 'youtube'];

interface ProgressState {
  status: 'idle' | 'loading' | 'done' | 'error';
  count?: number;
  error?: string;
}

interface Props {
  filmId: number;
  filmTitle: string;
  posterPath: string | null;
  backdropPath: string | null;
  onReady: () => void;
}

export default function LoadingScreen({ filmId, filmTitle, posterPath, backdropPath, onReady }: Props) {
  const [progress, setProgress] = useState<Record<SourceName, ProgressState>>(
    Object.fromEntries(SOURCE_ORDER.map((s) => [s, { status: 'idle' }])) as Record<SourceName, ProgressState>
  );
  const [currentQuote, setCurrentQuote] = useState<string>('');
  const [readyCount, setReadyCount] = useState(0);

  useEffect(() => {
    const es = new EventSource(`/api/film/${filmId}/ingest`);

    es.onmessage = (e) => {
      const event: IngestProgressEvent = JSON.parse(e.data);

      if (event.type === 'complete') {
        es.close();
        onReady();
        return;
      }

      if (event.source) {
        setProgress((prev) => {
          const updated = {
            ...prev,
            [event.source!]: {
              status: event.status ?? 'idle',
              count: event.count,
              error: event.error,
            },
          };

          // Count loaded sources (tmdb + at least 2 others)
          const doneCount = Object.values(updated).filter((v) => v.status === 'done').length;
          setReadyCount(doneCount);

          // Unlock if TMDB + 2 others done
          if (updated.tmdb.status === 'done' && doneCount >= 3) {
            // Give SSE a moment to finish sending complete signal
            setTimeout(onReady, 500);
          }

          return updated;
        });

        if (event.quote) {
          setCurrentQuote(event.quote);
        }
      }
    };

    es.onerror = () => {
      es.close();
      onReady(); // Unblock even on error
    };

    return () => es.close();
  }, [filmId, onReady]);

  return (
    <div className="min-h-screen flex items-center justify-center relative overflow-hidden">
      {/* Blurred backdrop */}
      {backdropPath && (
        <div className="absolute inset-0 z-0">
          <Image
            src={`https://image.tmdb.org/t/p/w1280${backdropPath}`}
            alt=""
            fill
            className="object-cover opacity-20 blur-xl scale-110"
          />
          <div className="absolute inset-0 bg-cinema-bg/80" />
        </div>
      )}

      <div className="relative z-10 max-w-md w-full mx-auto px-6">
        <div className="flex gap-6 mb-8">
          {/* Poster */}
          <div className="w-24 h-36 flex-shrink-0 rounded-lg overflow-hidden shadow-2xl">
            {posterPath ? (
              <Image
                src={getTmdbPosterUrl(posterPath, 'w342')}
                alt={filmTitle}
                width={96}
                height={144}
                className="object-cover w-full h-full"
              />
            ) : (
              <div className="w-full h-full bg-cinema-surface" />
            )}
          </div>
          {/* Title */}
          <div className="flex flex-col justify-center">
            <h1 className="font-display text-2xl text-white leading-tight">{filmTitle}</h1>
            <p className="text-cinema-muted text-sm mt-1">Gathering perspectives...</p>
          </div>
        </div>

        {/* Progress list */}
        <div className="space-y-3 mb-8">
          {SOURCE_ORDER.map((source) => {
            const state = progress[source];
            return (
              <div key={source} className="flex items-center gap-3">
                <div className="w-5 h-5 flex-shrink-0 flex items-center justify-center">
                  {state.status === 'done' && (
                    <svg className="w-5 h-5 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                  )}
                  {state.status === 'loading' && (
                    <svg className="w-4 h-4 text-cinema-accent animate-spin" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                  )}
                  {state.status === 'error' && (
                    <svg className="w-4 h-4 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  )}
                  {state.status === 'idle' && (
                    <div className="w-4 h-4 rounded-full border border-cinema-border" />
                  )}
                </div>
                <span className={`text-sm ${
                  state.status === 'done' ? 'text-white' :
                  state.status === 'error' ? 'text-red-400' :
                  state.status === 'loading' ? 'text-cinema-accent' :
                  'text-cinema-muted'
                }`}>
                  {SOURCE_LABELS[source]}
                  {state.status === 'done' && state.count ? ` (${state.count} ${state.count === 1 ? 'chunk' : 'chunks'})` : ''}
                  {state.status === 'error' ? ' — unavailable' : ''}
                </span>
              </div>
            );
          })}
        </div>

        {/* Ambient quote */}
        {currentQuote && (
          <div className="border-l-2 border-cinema-accent/40 pl-4">
            <p className="text-cinema-muted text-sm italic leading-relaxed">
              &quot;{currentQuote.length > 200 ? currentQuote.slice(0, 200) + '…' : currentQuote}&quot;
            </p>
            <p className="text-cinema-accent/60 text-xs mt-1">— Letterboxd</p>
          </div>
        )}

        {/* Progress bar */}
        <div className="mt-6 h-1 bg-cinema-surface rounded-full overflow-hidden">
          <div
            className="h-full bg-cinema-accent rounded-full transition-all duration-500"
            style={{ width: `${(readyCount / SOURCE_ORDER.length) * 100}%` }}
          />
        </div>
      </div>
    </div>
  );
}
