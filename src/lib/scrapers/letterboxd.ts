import * as cheerio from 'cheerio';
import { chunkText } from '@/lib/chunker';
import type { Chunk, TmdbFilm } from '@/types';
import { getFilmYear } from '@/lib/tmdb';

const LB_BASE = 'https://letterboxd.com';

// More complete browser headers to reduce bot detection
const HEADERS: Record<string, string> = {
  'User-Agent':
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
  Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
  'Accept-Language': 'en-US,en;q=0.9',
  'Cache-Control': 'no-cache',
  Pragma: 'no-cache',
  'Sec-Fetch-Dest': 'document',
  'Sec-Fetch-Mode': 'navigate',
  'Sec-Fetch-Site': 'none',
  'Upgrade-Insecure-Requests': '1',
};

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchPage(url: string): Promise<string | null> {
  try {
    const res = await fetch(url, { headers: HEADERS, redirect: 'follow' });
    if (!res.ok) return null;
    const text = await res.text();
    // Cloudflare / bot-check page detection
    if (text.includes('Just a moment') || text.includes('cf-browser-verification')) return null;
    return text;
  } catch {
    return null;
  }
}

// Best method: Letterboxd supports /tmdb/{id}/ which 302-redirects to /film/{slug}/
async function findSlugViaTmdbId(tmdbId: number): Promise<string | null> {
  try {
    const res = await fetch(`${LB_BASE}/tmdb/${tmdbId}/`, {
      headers: { 'User-Agent': HEADERS['User-Agent'] },
      redirect: 'manual', // Don't follow — we just need the Location header
    });
    const location = res.headers.get('location') ?? '';
    const match = location.match(/\/film\/([^/]+)\/?/);
    return match ? match[1] : null;
  } catch {
    return null;
  }
}

// Build likely slug candidates from title + year
function slugCandidates(title: string, year: string): string[] {
  const base = title
    .toLowerCase()
    .replace(/[''`]/g, '')
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-');

  const noLeadingThe = base.replace(/^the-/, '');
  return [base, `${base}-${year}`, noLeadingThe, `${noLeadingThe}-${year}`].filter(
    (s, i, arr) => s && arr.indexOf(s) === i
  );
}

async function probeSlug(slug: string): Promise<boolean> {
  try {
    const res = await fetch(`${LB_BASE}/film/${slug}/reviews/rss/`, {
      method: 'HEAD',
      headers: { 'User-Agent': HEADERS['User-Agent'] },
    });
    return res.ok;
  } catch {
    return false;
  }
}

async function findSlugViaSearch(title: string): Promise<string | null> {
  const encoded = encodeURIComponent(title);
  const html = await fetchPage(`${LB_BASE}/search/films/${encoded}/`);
  if (!html) return null;

  const $ = cheerio.load(html);
  let href = '';

  for (const sel of [
    '.film-list .film-detail-content h2 a',
    '.results .film-summary h2 a',
    'li.film-list-item a.frame',
    'a[href^="/film/"]',
  ]) {
    href = $(sel).first().attr('href') ?? '';
    if (href.startsWith('/film/')) break;
  }

  const match = href.match(/^\/film\/([^/]+)\/?/);
  return match ? match[1] : null;
}

async function findLetterboxdSlug(tmdbId: number, title: string, year: string): Promise<string | null> {
  // 1. Best: TMDB ID redirect (works for any film Letterboxd has indexed)
  const fromTmdb = await findSlugViaTmdbId(tmdbId);
  if (fromTmdb) {
    console.log(`[letterboxd] Found slug via TMDB ID: ${fromTmdb}`);
    return fromTmdb;
  }

  // 2. Try constructed slug candidates (no HTML parse needed)
  for (const candidate of slugCandidates(title, year)) {
    if (await probeSlug(candidate)) {
      console.log(`[letterboxd] Found slug via probe: ${candidate}`);
      return candidate;
    }
  }

  // 3. Fall back to Letterboxd's own search page
  await delay(500);
  const fromSearch = await findSlugViaSearch(title);
  if (fromSearch) console.log(`[letterboxd] Found slug via search: ${fromSearch}`);
  return fromSearch;
}

// Parse the reviews RSS feed — much more stable than scraping HTML
async function fetchReviewsRss(slug: string): Promise<string[]> {
  const xml = await fetchPage(`${LB_BASE}/film/${slug}/reviews/rss/`);
  if (!xml) return [];

  const $ = cheerio.load(xml, { xmlMode: true });
  const reviews: string[] = [];

  $('item').each((_, el) => {
    const raw = $(el).find('description').text();
    const text = raw
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
    if (text.length > 80) reviews.push(text);
  });

  return reviews;
}

// HTML fallback: scrape the /reviews/by/activity/ page
function extractReviewsFromHtml(html: string): string[] {
  const $ = cheerio.load(html);
  const reviews: string[] = [];

  for (const sel of [
    '.body-text.-prose.-truncate',
    '.body-text.collapsible-text',
    '[itemprop="reviewBody"]',
    '.review-body',
    '.body-text',
  ]) {
    $(sel).each((_, el) => {
      const text = $(el).text().trim();
      if (text.length > 80) reviews.push(text);
    });
    if (reviews.length) break;
  }

  return reviews;
}

function extractRating(html: string): string | null {
  const $ = cheerio.load(html);
  const el = $('.average-rating .display-rating, [class*="average-rating"]').first();
  if (el.length) return el.text().trim();

  const meta = $('meta[name="twitter:description"]').attr('content') ?? '';
  const match = meta.match(/(\d+\.?\d*)\s+out of 5/i);
  return match ? `${match[1]}/5` : null;
}

export async function scrapeLetterboxd(
  filmId: number,
  film: TmdbFilm
): Promise<{ chunks: Chunk[]; rating: string | null }> {
  const year = getFilmYear(film);
  const slug = await findLetterboxdSlug(filmId, film.title, year);

  if (!slug) {
    console.log(`[letterboxd] Could not find slug for "${film.title}" (${year})`);
    return { chunks: [], rating: null };
  }

  // Primary: RSS feed
  let reviews = await fetchReviewsRss(slug);

  // Fallback: HTML scrape
  if (!reviews.length) {
    await delay(800);
    const html = await fetchPage(`${LB_BASE}/film/${slug}/reviews/by/activity/`);
    if (html) {
      reviews = extractReviewsFromHtml(html);

      // Page 2
      await delay(800);
      const html2 = await fetchPage(`${LB_BASE}/film/${slug}/reviews/by/activity/page/2/`);
      if (html2) reviews.push(...extractReviewsFromHtml(html2));
    }
  }

  // Rating from main film page
  let rating: string | null = null;
  await delay(500);
  const filmHtml = await fetchPage(`${LB_BASE}/film/${slug}/`);
  if (filmHtml) rating = extractRating(filmHtml);

  if (!reviews.length) {
    console.log(`[letterboxd] Slug "${slug}" found but no reviews extracted`);
    return { chunks: [], rating };
  }

  const combined = reviews.join('\n\n---\n\n');
  const chunks = chunkText(combined, filmId, 'letterboxd', { slug, rating: rating ?? '' });
  return { chunks, rating };
}
