'use client';

import { useState } from 'react';
import Image from 'next/image';
import type { TmdbFilm } from '@/types';
import { getTmdbPosterUrl, extractDirector, getFilmYear } from '@/lib/tmdb';

interface Props {
  film: TmdbFilm;
  letterboxdRating?: string;
  tomatometer?: string;
}

function parseLetterboxdRating(s: string): number | null {
  const m = s.match(/(\d+\.?\d*)/);
  if (!m) return null;
  const n = parseFloat(m[1]);
  return isNaN(n) ? null : n;
}

function StarRating({ rating }: { rating: number }) {
  return (
    <div style={{ display: 'flex', gap: 2, alignItems: 'center' }}>
      {Array.from({ length: 5 }, (_, i) => {
        const fill = Math.min(1, Math.max(0, rating - i));
        const pct = `${fill * 100}%`;
        const id = `sf-${i}-${Math.round(rating * 10)}`;
        return (
          <svg key={i} width="13" height="13" viewBox="0 0 20 20">
            <defs>
              <linearGradient id={id}>
                <stop offset={pct} stopColor="#E8B74A" />
                <stop offset={pct} stopColor="#3A3A3A" />
              </linearGradient>
            </defs>
            <path
              d="M10 1l2.39 4.84 5.34.78-3.87 3.77.91 5.32L10 13.27l-4.77 2.51.91-5.32L2.27 6.7l5.34-.78L10 1z"
              fill={`url(#${id})`}
            />
          </svg>
        );
      })}
    </div>
  );
}

export default function FilmHeader({ film, letterboxdRating, tomatometer }: Props) {
  const [synopsisExpanded, setSynopsisExpanded] = useState(false);

  const director = extractDirector(film);
  const year = getFilmYear(film);
  const topCast = film.credits?.cast.slice(0, 4).map((c) => c.name) ?? [];
  const lbRating = letterboxdRating ? parseLetterboxdRating(letterboxdRating) : null;

  // Build ratings columns — only what we have
  const ratingCols: { label: string; display: React.ReactNode }[] = [];
  if (film.vote_average > 0) {
    ratingCols.push({
      label: 'TMDB',
      display: (
        <span style={{ fontSize: 20, fontFamily: 'var(--font-instrument), Georgia, serif', color: '#F0EDE6', lineHeight: 1 }}>
          {film.vote_average.toFixed(1)}
        </span>
      ),
    });
  }
  if (tomatometer) {
    ratingCols.push({
      label: 'Tomatometer',
      display: (
        <span style={{ fontSize: 20, fontFamily: 'var(--font-instrument), Georgia, serif', color: '#F0EDE6', lineHeight: 1 }}>
          🍅{tomatometer}
        </span>
      ),
    });
  }

  return (
    <div style={{ display: 'flex', gap: 32, alignItems: 'flex-start' }}>
      {/* Poster */}
      <div
        style={{
          width: 200,
          flexShrink: 0,
          borderRadius: 6,
          overflow: 'hidden',
          boxShadow: '0 20px 60px rgba(0,0,0,0.5)',
          animation: 'fadeIn 0.5s ease',
        }}
      >
        <Image
          src={getTmdbPosterUrl(film.poster_path, 'w500')}
          alt={film.title}
          width={200}
          height={300}
          className="object-cover w-full h-auto"
          priority
        />
      </div>

      {/* Info */}
      <div style={{ flex: 1, paddingTop: 4, animation: 'fadeUp 0.4s ease' }}>
        {/* Genre pills */}
        {film.genres.length > 0 && (
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 14 }}>
            {film.genres.map((g) => (
              <span
                key={g.id}
                style={{
                  fontSize: 10,
                  fontWeight: 500,
                  letterSpacing: '0.08em',
                  textTransform: 'uppercase',
                  color: '#777',
                  padding: '3px 8px',
                  background: '#13130F',
                  borderRadius: 4,
                }}
              >
                {g.name}
              </span>
            ))}
          </div>
        )}

        {/* Title */}
        <h1
          style={{
            fontSize: 44,
            fontFamily: 'var(--font-instrument), Georgia, serif',
            fontWeight: 400,
            lineHeight: 1.05,
            color: '#F0EDE6',
          }}
        >
          {film.title}
        </h1>

        {/* Director · Year · Runtime */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 10, fontSize: 14, color: '#777' }}>
          {director && <span style={{ color: '#BBB8B0' }}>{director}</span>}
          {director && <span style={{ color: '#333' }}>·</span>}
          <span>{year}</span>
          {film.runtime && (
            <>
              <span style={{ color: '#333' }}>·</span>
              <span>{film.runtime} min</span>
            </>
          )}
        </div>

        {/* Ratings row */}
        {(ratingCols.length > 0 || lbRating !== null) && (
          <div
            style={{
              display: 'flex',
              gap: 20,
              marginTop: 24,
              padding: '18px 0',
              borderTop: '1px solid #171715',
              borderBottom: '1px solid #171715',
              alignItems: 'center',
            }}
          >
            {ratingCols.map((r) => (
              <div key={r.label} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3 }}>
                <span style={{ fontSize: 9, fontWeight: 600, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#555' }}>
                  {r.label}
                </span>
                {r.display}
              </div>
            ))}

            {ratingCols.length > 0 && lbRating !== null && (
              <div style={{ width: 1, height: 28, background: '#1C1C1A' }} />
            )}

            {lbRating !== null && (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3 }}>
                <span style={{ fontSize: 9, fontWeight: 600, letterSpacing: '0.1em', textTransform: 'uppercase', color: '#555' }}>
                  Letterboxd
                </span>
                <StarRating rating={lbRating} />
                <span style={{ fontSize: 10, color: '#555' }}>{lbRating.toFixed(1)}/5</span>
              </div>
            )}
          </div>
        )}

        {/* Synopsis */}
        {film.overview && (
          <div style={{ marginTop: 16 }}>
            <p
              style={{
                fontSize: 13.5,
                lineHeight: 1.7,
                color: '#888',
                display: '-webkit-box',
                WebkitLineClamp: synopsisExpanded ? 'unset' : 2,
                WebkitBoxOrient: 'vertical',
                overflow: synopsisExpanded ? 'visible' : 'hidden',
              }}
            >
              {film.overview}
            </p>
            {!synopsisExpanded && (
              <button
                onClick={() => setSynopsisExpanded(true)}
                style={{
                  background: 'none',
                  border: 'none',
                  color: '#E8B74A',
                  fontSize: 12,
                  cursor: 'pointer',
                  marginTop: 4,
                  fontFamily: 'inherit',
                  fontWeight: 500,
                }}
              >
                More
              </button>
            )}
          </div>
        )}

        {/* Cast */}
        {topCast.length > 0 && (
          <div style={{ marginTop: 10, fontSize: 12, color: '#555' }}>
            {topCast.join(' · ')}
          </div>
        )}
      </div>
    </div>
  );
}
