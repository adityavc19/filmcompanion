import * as cheerio from 'cheerio';
import { chunkText } from '@/lib/chunker';
import type { Chunk, TmdbFilm } from '@/types';
import { getFilmYear } from '@/lib/tmdb';

const RT_BASE = 'https://www.rottentomatoes.com';

const HEADERS = {
  'User-Agent':
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
  Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
  'Accept-Language': 'en-US,en;q=0.9',
  'Sec-Fetch-Dest': 'document',
  'Sec-Fetch-Mode': 'navigate',
  'Sec-Fetch-Site': 'none',
  'Upgrade-Insecure-Requests': '1',
};

function buildRtSlug(title: string, year: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, '')
    .replace(/\s+/g, '_')
    + (year ? `_${year}` : '');
}

function isCloudflareBlock(html: string): boolean {
  return (
    html.includes('Just a moment') ||
    html.includes('cf-browser-verification') ||
    html.includes('Checking your browser')
  );
}

export async function scrapeRottenTomatoes(
  filmId: number,
  film: TmdbFilm
): Promise<{ chunks: Chunk[]; tomatometer: string | null }> {
  const year = getFilmYear(film);
  const slug = buildRtSlug(film.title, year);

  // Try with and without year suffix
  const urls = [
    `${RT_BASE}/m/${slug}`,
    `${RT_BASE}/m/${buildRtSlug(film.title, '')}`,
  ];

  for (const url of urls) {
    try {
      const res = await fetch(url, { headers: HEADERS });
      if (!res.ok) continue;

      const html = await res.text();
      if (isCloudflareBlock(html)) {
        console.warn('RT: Cloudflare block detected');
        return { chunks: [], tomatometer: null };
      }

      const $ = cheerio.load(html);

      // Extract tomatometer score from score-board web component attribute
      const scoreboard = $('score-board, [data-qa="score-board"]');
      let tomatometer: string | null = null;

      if (scoreboard.length) {
        const score = scoreboard.attr('tomatometerscore') ?? scoreboard.attr('tomato-score');
        if (score) tomatometer = `${score}%`;
      }

      // Fallback: look for score in rt-text elements
      if (!tomatometer) {
        $('rt-text[slot="criticsScore"], [data-qa="tomatometer-value"]').each((_, el) => {
          const text = $(el).text().trim();
          if (text && !tomatometer) tomatometer = text.includes('%') ? text : `${text}%`;
        });
      }

      // Extract critics consensus
      const consensus =
        $('[data-qa="critics-consensus"], .mop-ratings-wrap__text--concensus, [class*="consensus"]')
          .first()
          .text()
          .trim();

      // Extract critic review snippets
      const reviewSnippets: string[] = [];
      $('[data-qa="review-text"], .review_table_row .review-text, .critics-consensus__copy').each(
        (_, el) => {
          const text = $(el).text().trim();
          if (text.length > 30) reviewSnippets.push(text);
        }
      );

      const parts: string[] = [];
      if (tomatometer) parts.push(`Rotten Tomatoes: ${tomatometer} Tomatometer`);
      if (consensus) parts.push(`Critics Consensus: ${consensus}`);
      if (reviewSnippets.length) parts.push(`Critic snippets:\n${reviewSnippets.slice(0, 10).join('\n')}`);

      if (!parts.length) continue;

      const combined = parts.join('\n\n');
      const chunks = chunkText(combined, filmId, 'rottentomatoes', { tomatometer: tomatometer ?? '' });
      return { chunks, tomatometer };
    } catch {
      continue;
    }
  }

  return { chunks: [], tomatometer: null };
}
