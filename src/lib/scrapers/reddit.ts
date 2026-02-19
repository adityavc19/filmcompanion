import { chunkText } from '@/lib/chunker';
import type { Chunk, TmdbFilm } from '@/types';
import { getFilmYear } from '@/lib/tmdb';

// old.reddit.com is significantly more lenient with server-side requests
const REDDIT_BASE = 'https://old.reddit.com';
const USER_AGENT =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36';

interface RedditPost {
  id: string;
  title: string;
  selftext: string;
  score: number;
  url: string;
  permalink: string;
}

interface RedditComment {
  body: string;
  score: number;
}

interface RedditListing<T> {
  data: { children: { kind: string; data: T }[] };
}

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function redditGet<T>(path: string): Promise<T> {
  const res = await fetch(`${REDDIT_BASE}${path}`, {
    headers: {
      'User-Agent': USER_AGENT,
      Accept: 'application/json',
    },
  });
  if (!res.ok) {
    console.log(`[reddit] ${res.status} ${res.statusText} for ${path}`);
    throw new Error(`Reddit ${res.status}: ${path}`);
  }
  return res.json();
}

export async function scrapeReddit(filmId: number, film: TmdbFilm): Promise<Chunk[]> {
  const year = getFilmYear(film);
  const query = encodeURIComponent(`${film.title} ${year}`);

  const posts: RedditPost[] = [];

  // Search film-focused subreddits with delays between requests
  const subreddits = ['movies', 'TrueFilm', 'flicks'];
  for (const sub of subreddits) {
    try {
      const data = await redditGet<RedditListing<RedditPost>>(
        `/r/${sub}/search.json?q=${query}&sort=relevance&limit=5&restrict_sr=true`
      );
      const found = data.data.children
        .filter((c) => c.kind === 't3' && c.data.score > 2)
        .map((c) => c.data);
      posts.push(...found.slice(0, 2));
      if (posts.length >= 4) break; // Enough posts, skip remaining subs
      await delay(600);
    } catch (e) {
      console.log(`[reddit] r/${sub} search failed:`, (e as Error).message);
    }
  }

  // Fallback: site-wide search
  if (!posts.length) {
    try {
      await delay(600);
      const data = await redditGet<RedditListing<RedditPost>>(
        `/search.json?q=${query}+film&sort=relevance&limit=10&type=link`
      );
      const found = data.data.children
        .filter((c) => c.kind === 't3' && c.data.score > 3)
        .map((c) => c.data);
      posts.push(...found.slice(0, 5));
    } catch (e) {
      console.log('[reddit] global search failed:', (e as Error).message);
      return [];
    }
  }

  const allText: string[] = [];

  for (const post of posts.slice(0, 4)) {
    if (post.selftext && post.selftext !== '[removed]' && post.selftext !== '[deleted]') {
      allText.push(`Post: ${post.title}\n\n${post.selftext}`);
    } else {
      allText.push(`Discussion: ${post.title}`);
    }

    // Fetch top comments — delay between each to avoid rate limits
    try {
      await delay(500);
      const commentData = await redditGet<[unknown, RedditListing<RedditComment>]>(
        `${post.permalink}.json?depth=1&limit=20`
      );
      const comments = commentData[1].data.children
        .filter(
          (c) =>
            c.kind === 't1' &&
            typeof c.data.body === 'string' &&
            c.data.body !== '[removed]' &&
            c.data.body !== '[deleted]' &&
            c.data.score >= 3 &&
            c.data.body.length > 40
        )
        .map((c) => c.data.body)
        .slice(0, 8);

      if (comments.length) {
        allText.push(comments.join('\n\n'));
      }
    } catch {
      // Comment fetch failed — skip
    }
  }

  if (!allText.length) return [];

  const combined = allText.join('\n\n---\n\n');
  return chunkText(combined, filmId, 'reddit');
}
