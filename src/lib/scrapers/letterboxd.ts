import * as cheerio from 'cheerio';
import { chunkText } from '@/lib/chunker';
import type { Chunk, TmdbFilm } from '@/types';
import { getFilmYear } from '@/lib/tmdb';

const LB_BASE = 'https://letterboxd.com';
const USER_AGENT =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36';

const HEADERS = {
  'User-Agent': USER_AGENT,
  Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  'Accept-Language': 'en-US,en;q=0.9',
  'Accept-Encoding': 'gzip, deflate, br',
};

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchHtml(url: string): Promise<string | null> {
  try {
    const res = await fetch(url, { headers: HEADERS });
    if (!res.ok) return null;
    return res.text();
  } catch {
    return null;
  }
}

async function findLetterboxdSlug(title: string, year: string): Promise<string | null> {
  const encoded = encodeURIComponent(title);
  const searchUrl = `${LB_BASE}/search/films/${encoded}/`;
  const html = await fetchHtml(searchUrl);
  if (!html) return null;

  const $ = cheerio.load(html);

  // Find the first film result link
  const firstResult = $('.film-list .film-detail-content h2 a, .results .film-summary h2 a, li.film-list-item a.frame').first();
  let href = firstResult.attr('href') ?? '';

  // Try alternative selectors
  if (!href) {
    $('a[href^="/film/"]').each((_, el) => {
      const h = $(el).attr('href') ?? '';
      if (h.startsWith('/film/') && !href) href = h;
    });
  }

  if (!href) return null;
  // href is like /film/stalker/ → return "stalker"
  const match = href.match(/^\/film\/([^/]+)\/?/);
  return match ? match[1] : null;
}

function extractReviews(html: string): string[] {
  const $ = cheerio.load(html);
  const reviews: string[] = [];

  // Primary selector
  $('.body-text.-prose.-truncate, .body-text.collapsible-text').each((_, el) => {
    const text = $(el).text().trim();
    if (text.length > 50) reviews.push(text);
  });

  // Fallback: itemprop
  if (!reviews.length) {
    $('[itemprop="reviewBody"], .review-body').each((_, el) => {
      const text = $(el).text().trim();
      if (text.length > 50) reviews.push(text);
    });
  }

  // Second fallback: any paragraph-rich block in a review container
  if (!reviews.length) {
    $('.review .body-text, .film-detail-review').each((_, el) => {
      const text = $(el).text().trim();
      if (text.length > 50) reviews.push(text);
    });
  }

  return reviews;
}

function extractRating(html: string): string | null {
  const $ = cheerio.load(html);
  // Letterboxd shows average rating in a specific element
  const ratingEl = $('.average-rating .display-rating, [class*="average-rating"]').first();
  if (ratingEl.length) return ratingEl.text().trim();

  // Try meta tag
  const meta = $('meta[name="twitter:description"]').attr('content') ?? '';
  const match = meta.match(/(\d+\.?\d*) out of 5/i);
  return match ? `${match[1]}/5` : null;
}

export async function scrapeLetterboxd(filmId: number, film: TmdbFilm): Promise<{ chunks: Chunk[]; rating: string | null }> {
  const year = getFilmYear(film);
  const slug = await findLetterboxdSlug(film.title, year);

  if (!slug) {
    return { chunks: [], rating: null };
  }

  const reviewsUrl = `${LB_BASE}/film/${slug}/reviews/by/activity/`;
  const html1 = await fetchHtml(reviewsUrl);
  if (!html1) return { chunks: [], rating: null };

  const rating = extractRating(html1);
  const reviews = extractReviews(html1);

  // Fetch page 2
  await delay(1000);
  const html2 = await fetchHtml(`${reviewsUrl}page/2/`);
  if (html2) {
    reviews.push(...extractReviews(html2));
  }

  const combined = reviews.join('\n\n---\n\n');
  const chunks = chunkText(combined, filmId, 'letterboxd', { slug, rating: rating ?? '' });

  return { chunks, rating };
}
