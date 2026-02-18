import type { TmdbFilm, TmdbSearchResult } from '@/types';

const TMDB_BASE = 'https://api.themoviedb.org/3';
export const TMDB_IMAGE_BASE = 'https://image.tmdb.org/t/p';

function buildTmdbUrl(path: string): string {
  const key = process.env.TMDB_API_KEY ?? '';
  // v4 Read Access Token starts with "eyJ" — use as Bearer header
  // v3 API key is a short alphanumeric string — append as query param
  if (key.startsWith('eyJ')) {
    return `${TMDB_BASE}${path}`;
  }
  const sep = path.includes('?') ? '&' : '?';
  return `${TMDB_BASE}${path}${sep}api_key=${key}`;
}

function getHeaders(): Record<string, string> {
  const key = process.env.TMDB_API_KEY ?? '';
  if (key.startsWith('eyJ')) {
    return { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' };
  }
  return { 'Content-Type': 'application/json' };
}

async function tmdbFetch<T>(path: string): Promise<T> {
  const res = await fetch(buildTmdbUrl(path), {
    headers: getHeaders(),
    next: { revalidate: 3600 },
  });
  if (!res.ok) {
    throw new Error(`TMDB error ${res.status} for ${path}`);
  }
  return res.json();
}

export function getTmdbPosterUrl(
  path: string | null,
  size: 'w185' | 'w342' | 'w500' | 'w780' | 'original' = 'w500'
): string {
  if (!path) return '/placeholder-poster.png';
  return `${TMDB_IMAGE_BASE}/${size}${path}`;
}

export function getTmdbBackdropUrl(
  path: string | null,
  size: 'w780' | 'w1280' | 'original' = 'w1280'
): string {
  if (!path) return '';
  return `${TMDB_IMAGE_BASE}/${size}${path}`;
}

export async function searchFilms(query: string): Promise<TmdbSearchResult[]> {
  const encoded = encodeURIComponent(query);
  const data = await tmdbFetch<{ results: TmdbSearchResult[] }>(
    `/search/movie?query=${encoded}&page=1&include_adult=false`
  );
  return data.results ?? [];
}

export async function getFilmDetail(id: number): Promise<TmdbFilm> {
  return tmdbFetch<TmdbFilm>(`/movie/${id}?append_to_response=credits`);
}

export function extractDirector(film: TmdbFilm): string | null {
  return film.credits?.crew.find((c) => c.job === 'Director')?.name ?? null;
}

export function getFilmYear(film: TmdbFilm | TmdbSearchResult): string {
  return film.release_date ? film.release_date.slice(0, 4) : 'N/A';
}
