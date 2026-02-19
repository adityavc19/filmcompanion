import { getFilmDetail } from '@/lib/tmdb';
import {
  hasFilm,
  isReady,
  initFilm,
  addChunks,
  markSourceLoaded,
  setSentiment,
  setStarterChips,
  getFilm,
  loadFromDb,
  saveToDb,
} from '@/lib/knowledge-store';
import { scrapeLetterboxd } from '@/lib/scrapers/letterboxd';
import { scrapeReddit } from '@/lib/scrapers/reddit';
import { scrapeRottenTomatoes } from '@/lib/scrapers/rottentomatoes';
import { scrapeYoutube } from '@/lib/scrapers/youtube';
import { generateDerivedContent } from '@/lib/claude';
import { chunkText } from '@/lib/chunker';
import type { IngestProgressEvent } from '@/types';

export const runtime = 'nodejs';
export const maxDuration = 60;

const SSE_HEADERS = {
  'Content-Type': 'text/event-stream',
  'Cache-Control': 'no-cache, no-transform',
  Connection: 'keep-alive',
  'X-Accel-Buffering': 'no',
};

const cached: IngestProgressEvent = { type: 'complete', cached: true };

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const filmId = parseInt(id, 10);
  if (isNaN(filmId)) {
    return Response.json({ error: 'Invalid film ID' }, { status: 400 });
  }

  // L1: in-memory hit
  if (hasFilm(filmId) && isReady(filmId)) {
    return new Response(`data: ${JSON.stringify(cached)}\n\n`, { headers: SSE_HEADERS });
  }

  // L2: Supabase hit — load into memory then return immediately
  const fromDb = await loadFromDb(filmId);
  if (fromDb && isReady(filmId)) {
    console.log(`[ingest] cache hit from DB for film ${filmId}`);
    return new Response(`data: ${JSON.stringify(cached)}\n\n`, { headers: SSE_HEADERS });
  }

  // L3: Full ingest — scrape, generate, then persist to DB
  const stream = new ReadableStream({
    async start(controller) {
      const encoder = new TextEncoder();

      const send = (event: IngestProgressEvent) => {
        try {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`));
        } catch {
          // Controller may be closed
        }
      };

      try {
        // Step 1: TMDB
        send({ source: 'tmdb', status: 'loading' });
        const tmdbData = await getFilmDetail(filmId);
        initFilm(filmId, tmdbData);

        if (tmdbData.overview) {
          addChunks(filmId, chunkText(tmdbData.overview, filmId, 'tmdb'));
        }
        markSourceLoaded(filmId, 'tmdb');
        send({ source: 'tmdb', status: 'done', count: 1 });

        // Step 2: Run all scrapers in parallel
        const scraperResults = await Promise.allSettled([
          scrapeLetterboxd(filmId, tmdbData).then(({ chunks, rating }) => {
            if (chunks.length) {
              addChunks(filmId, chunks);
              markSourceLoaded(filmId, 'letterboxd');
              const quote = chunks[0]?.text.slice(0, 160);
              send({ source: 'letterboxd', status: 'done', count: chunks.length, quote });
              if (rating) {
                const film = getFilm(filmId);
                if (film) film.sentiment.letterboxdRating = rating;
              }
            } else {
              send({ source: 'letterboxd', status: 'error', error: 'No reviews found' });
            }
          }).catch((e: Error) => send({ source: 'letterboxd', status: 'error', error: e.message })),

          scrapeReddit(filmId, tmdbData).then((chunks) => {
            if (chunks.length) {
              addChunks(filmId, chunks);
              markSourceLoaded(filmId, 'reddit');
              send({ source: 'reddit', status: 'done', count: chunks.length });
            } else {
              send({ source: 'reddit', status: 'error', error: 'No discussions found' });
            }
          }).catch((e: Error) => send({ source: 'reddit', status: 'error', error: e.message })),

          scrapeRottenTomatoes(filmId, tmdbData).then(({ chunks, tomatometer }) => {
            if (chunks.length) {
              addChunks(filmId, chunks);
              markSourceLoaded(filmId, 'rottentomatoes');
              send({ source: 'rottentomatoes', status: 'done', count: chunks.length });
              if (tomatometer) {
                const film = getFilm(filmId);
                if (film) film.sentiment.tomatometer = tomatometer;
              }
            } else {
              send({ source: 'rottentomatoes', status: 'error', error: 'Could not load page' });
            }
          }).catch((e: Error) => send({ source: 'rottentomatoes', status: 'error', error: e.message })),

          scrapeYoutube(filmId, tmdbData).then((chunks) => {
            if (chunks.length) {
              addChunks(filmId, chunks);
              markSourceLoaded(filmId, 'youtube');
              send({ source: 'youtube', status: 'done', count: chunks.length });
            } else {
              send({ source: 'youtube', status: 'error', error: 'No transcripts available' });
            }
          }).catch((e: Error) => send({ source: 'youtube', status: 'error', error: e.message })),
        ]);

        console.log('Scraper results:', scraperResults.map((r) => r.status));

        // Step 3: Generate sentiment + starter chips
        const film = getFilm(filmId);
        if (film) {
          try {
            const derived = await generateDerivedContent(film);
            setSentiment(filmId, {
              ...derived.sentiment,
              letterboxdRating: film.sentiment.letterboxdRating,
              tomatometer: film.sentiment.tomatometer,
            });
            setStarterChips(filmId, derived.chips);
          } catch (e) {
            console.error('Failed to generate derived content:', e);
          }
        }

        // Step 4: Persist to Supabase (fire-and-forget — don't block SSE close)
        saveToDb(filmId).catch((e) => console.error('saveToDb failed:', e));

        send({ type: 'complete' });
      } catch (err) {
        console.error('Ingest pipeline error:', err);
        send({ type: 'complete' });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, { headers: SSE_HEADERS });
}
