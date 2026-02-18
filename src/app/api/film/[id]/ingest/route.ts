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

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const filmId = parseInt(id, 10);
  if (isNaN(filmId)) {
    return Response.json({ error: 'Invalid film ID' }, { status: 400 });
  }

  // Already fully ingested — return immediately
  if (hasFilm(filmId) && isReady(filmId)) {
    const complete: IngestProgressEvent = { type: 'complete', cached: true };
    return new Response(`data: ${JSON.stringify(complete)}\n\n`, {
      headers: SSE_HEADERS,
    });
  }

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

        // Add TMDB overview as a chunk
        if (tmdbData.overview) {
          const tmdbChunks = chunkText(tmdbData.overview, filmId, 'tmdb');
          addChunks(filmId, tmdbChunks);
        }
        markSourceLoaded(filmId, 'tmdb');
        send({ source: 'tmdb', status: 'done', count: 1 });

        // Step 2: Run all scrapers in parallel
        const scraperResults = await Promise.allSettled([
          // Letterboxd
          scrapeLetterboxd(filmId, tmdbData).then(({ chunks, rating }) => {
            if (chunks.length) {
              addChunks(filmId, chunks);
              markSourceLoaded(filmId, 'letterboxd');
              const quote = chunks[0]?.text.slice(0, 160);
              send({
                source: 'letterboxd',
                status: 'done',
                count: chunks.length,
                quote,
              });
              // Store rating in knowledge store sentiment
              if (rating) {
                const film = getFilm(filmId);
                if (film) film.sentiment.letterboxdRating = rating;
              }
            } else {
              send({ source: 'letterboxd', status: 'error', error: 'No reviews found' });
            }
          }).catch((e: Error) => {
            send({ source: 'letterboxd', status: 'error', error: e.message });
          }),

          // Reddit
          scrapeReddit(filmId, tmdbData).then((chunks) => {
            if (chunks.length) {
              addChunks(filmId, chunks);
              markSourceLoaded(filmId, 'reddit');
              send({ source: 'reddit', status: 'done', count: chunks.length });
            } else {
              send({ source: 'reddit', status: 'error', error: 'No discussions found' });
            }
          }).catch((e: Error) => {
            send({ source: 'reddit', status: 'error', error: e.message });
          }),

          // Rotten Tomatoes
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
          }).catch((e: Error) => {
            send({ source: 'rottentomatoes', status: 'error', error: e.message });
          }),

          // YouTube
          scrapeYoutube(filmId, tmdbData).then((chunks) => {
            if (chunks.length) {
              addChunks(filmId, chunks);
              markSourceLoaded(filmId, 'youtube');
              send({ source: 'youtube', status: 'done', count: chunks.length });
            } else {
              send({ source: 'youtube', status: 'error', error: 'No transcripts available' });
            }
          }).catch((e: Error) => {
            send({ source: 'youtube', status: 'error', error: e.message });
          }),
        ]);

        console.log('Scraper results:', scraperResults.map((r) => r.status));

        // Step 3: Generate sentiment + starter chips from collected chunks
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

        send({ type: 'complete' });
      } catch (err) {
        console.error('Ingest pipeline error:', err);
        send({ type: 'complete' }); // Still signal completion to unblock UI
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, { headers: SSE_HEADERS });
}
