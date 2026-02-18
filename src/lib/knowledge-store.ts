/**
 * In-memory knowledge store, keyed by TMDB film ID.
 *
 * NOTE: This Map lives in the Node.js process. In local dev (next dev), it
 * persists across requests within the same process. On Vercel, each serverless
 * function invocation may be a separate instance — the cache may not persist
 * between requests. This is acceptable for the MVP; add Vercel KV post-MVP.
 */
import type { Chunk, FilmKnowledge, SentimentSummary, SourceName, TmdbFilm } from '@/types';

const store = new Map<number, FilmKnowledge>();

export function hasFilm(filmId: number): boolean {
  return store.has(filmId);
}

export function getFilm(filmId: number): FilmKnowledge | undefined {
  return store.get(filmId);
}

export function initFilm(filmId: number, tmdbData: TmdbFilm): void {
  if (store.has(filmId)) return;
  store.set(filmId, {
    filmId,
    tmdbData,
    chunks: [],
    sentiment: { critics: '', audiences: '', tension: '' },
    starterChips: [],
    sourcesLoaded: [],
    ingestedAt: Date.now(),
  });
}

export function addChunks(filmId: number, newChunks: Chunk[]): void {
  const film = store.get(filmId);
  if (!film) return;
  film.chunks.push(...newChunks);
}

export function markSourceLoaded(filmId: number, source: SourceName): void {
  const film = store.get(filmId);
  if (!film) return;
  if (!film.sourcesLoaded.includes(source)) {
    film.sourcesLoaded.push(source);
  }
}

export function getLoadedSources(filmId: number): SourceName[] {
  return store.get(filmId)?.sourcesLoaded ?? [];
}

export function setSentiment(filmId: number, sentiment: SentimentSummary): void {
  const film = store.get(filmId);
  if (!film) return;
  film.sentiment = sentiment;
}

export function setStarterChips(filmId: number, chips: string[]): void {
  const film = store.get(filmId);
  if (!film) return;
  film.starterChips = chips;
}

export function isReady(filmId: number): boolean {
  const film = store.get(filmId);
  if (!film) return false;
  // Ready when TMDB + at least 2 other sources are loaded
  return film.sourcesLoaded.includes('tmdb') && film.sourcesLoaded.length >= 3;
}
