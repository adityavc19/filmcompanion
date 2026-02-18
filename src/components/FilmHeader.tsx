import Image from 'next/image';
import type { TmdbFilm } from '@/types';
import { getTmdbPosterUrl, extractDirector, getFilmYear } from '@/lib/tmdb';

interface Props {
  film: TmdbFilm;
  letterboxdRating?: string;
  tomatometer?: string;
}

export default function FilmHeader({ film, letterboxdRating, tomatometer }: Props) {
  const director = extractDirector(film);
  const year = getFilmYear(film);
  const topCast = film.credits?.cast.slice(0, 4).map((c) => c.name) ?? [];

  return (
    <div className="flex gap-6 md:gap-8">
      {/* Poster */}
      <div className="flex-shrink-0">
        <div className="w-32 md:w-44 rounded-xl overflow-hidden shadow-2xl ring-1 ring-white/10">
          <Image
            src={getTmdbPosterUrl(film.poster_path, 'w500')}
            alt={film.title}
            width={176}
            height={264}
            className="object-cover w-full h-auto"
            priority
          />
        </div>
      </div>

      {/* Metadata */}
      <div className="flex-1 min-w-0 py-1">
        <h1 className="font-display text-3xl md:text-4xl text-white leading-tight">
          {film.title}
        </h1>

        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-2 text-cinema-muted text-sm">
          {director && <span>{director}</span>}
          {director && <span className="text-cinema-border">·</span>}
          <span>{year}</span>
          {film.runtime && (
            <>
              <span className="text-cinema-border">·</span>
              <span>{film.runtime} min</span>
            </>
          )}
          {film.genres.length > 0 && (
            <>
              <span className="text-cinema-border">·</span>
              <span>{film.genres.slice(0, 2).map((g) => g.name).join(', ')}</span>
            </>
          )}
        </div>

        {/* Ratings row */}
        <div className="flex flex-wrap gap-4 mt-4">
          {film.vote_average > 0 && (
            <div className="flex items-center gap-1.5">
              <span className="text-cinema-accent text-lg">★</span>
              <span className="text-white font-semibold">{film.vote_average.toFixed(1)}</span>
              <span className="text-cinema-muted text-xs">TMDB</span>
            </div>
          )}
          {tomatometer && (
            <div className="flex items-center gap-1.5">
              <span className="text-red-400">🍅</span>
              <span className="text-white font-semibold">{tomatometer}</span>
              <span className="text-cinema-muted text-xs">RT</span>
            </div>
          )}
          {letterboxdRating && (
            <div className="flex items-center gap-1.5">
              <span className="text-emerald-400">◆</span>
              <span className="text-white font-semibold">{letterboxdRating}</span>
              <span className="text-cinema-muted text-xs">LB</span>
            </div>
          )}
        </div>

        {/* Synopsis */}
        {film.overview && (
          <p className="text-cinema-muted text-sm leading-relaxed mt-4 max-w-2xl line-clamp-3">
            {film.overview}
          </p>
        )}

        {/* Cast */}
        {topCast.length > 0 && (
          <p className="text-cinema-muted text-xs mt-3">
            <span className="text-cinema-border uppercase tracking-wider text-xs mr-2">Cast</span>
            {topCast.join(' · ')}
          </p>
        )}
      </div>
    </div>
  );
}
