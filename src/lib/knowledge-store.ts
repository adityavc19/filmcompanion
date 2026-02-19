import type { Chunk, FilmKnowledge, SentimentSummary, SourceName, TmdbFilm } from '@/types';
import { supabase } from '@/lib/supabase';

// L1: in-process memory cache — fast, lives as long as the Railway process does
const store = new Map<number, FilmKnowledge>();

// ─── In-memory operations ──────────────────────────────────────────────────

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
  if (!film.sourcesLoaded.includes(source)) film.sourcesLoaded.push(source);
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
  return film.sourcesLoaded.includes('tmdb') && film.sourcesLoaded.length >= 3;
}

// ─── Supabase (L2) operations ──────────────────────────────────────────────

/**
 * Try to load a film from Supabase into the in-memory store.
 * Returns true if found and loaded, false if not found or on error.
 */
export async function loadFromDb(filmId: number): Promise<boolean> {
  try {
    const { data: filmRow, error: filmErr } = await supabase
      .from('films')
      .select('*')
      .eq('film_id', filmId)
      .single();

    if (filmErr || !filmRow) return false;

    const { data: chunkRows, error: chunkErr } = await supabase
      .from('film_chunks')
      .select('*')
      .eq('film_id', filmId);

    if (chunkErr) return false;

    store.set(filmId, {
      filmId,
      tmdbData: filmRow.tmdb_data as TmdbFilm,
      chunks: (chunkRows ?? []).map((row) => ({
        id: row.id as string,
        filmId: row.film_id as number,
        source: row.source as SourceName,
        text: row.text as string,
        metadata: row.metadata as Record<string, string | number> | undefined,
      })),
      sentiment: filmRow.sentiment as SentimentSummary,
      starterChips: filmRow.starter_chips as string[],
      sourcesLoaded: filmRow.sources_loaded as SourceName[],
      ingestedAt: filmRow.ingested_at as number,
    });

    return true;
  } catch (err) {
    console.error('loadFromDb error:', err);
    return false;
  }
}

/**
 * Persist the in-memory film knowledge to Supabase.
 * Chunks are replaced entirely (delete + re-insert in batches of 500).
 */
export async function saveToDb(filmId: number): Promise<void> {
  const film = store.get(filmId);
  if (!film) return;

  try {
    const { error: upsertErr } = await supabase.from('films').upsert({
      film_id: film.filmId,
      tmdb_data: film.tmdbData,
      sentiment: film.sentiment,
      starter_chips: film.starterChips,
      sources_loaded: film.sourcesLoaded,
      ingested_at: film.ingestedAt,
    });

    if (upsertErr) {
      console.error('saveToDb upsert error:', upsertErr);
      return;
    }

    if (film.chunks.length === 0) return;

    await supabase.from('film_chunks').delete().eq('film_id', filmId);

    const BATCH = 500;
    for (let i = 0; i < film.chunks.length; i += BATCH) {
      const batch = film.chunks.slice(i, i + BATCH).map((c) => ({
        id: c.id,
        film_id: c.filmId,
        source: c.source,
        text: c.text,
        metadata: c.metadata ?? null,
      }));
      const { error: insertErr } = await supabase.from('film_chunks').insert(batch);
      if (insertErr) console.error(`saveToDb chunk batch error at ${i}:`, insertErr);
    }
  } catch (err) {
    console.error('saveToDb error:', err);
  }
}
