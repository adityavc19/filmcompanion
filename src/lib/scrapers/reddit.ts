import { chunkText } from '@/lib/chunker';
import type { Chunk, TmdbFilm } from '@/types';
import { getFilmYear } from '@/lib/tmdb';

// Reddit exposes public .json endpoints on every page — no credentials needed.
// Only requirement: a non-empty User-Agent header (Reddit blocks the default fetch UA).
const REDDIT_BASE = 'https://www.reddit.com';
const USER_AGENT = 'FilmCompanion/1.0 (film discussion app)';

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

async function redditGet<T>(path: string): Promise<T> {
  const res = await fetch(`${REDDIT_BASE}${path}`, {
    headers: {
      'User-Agent': USER_AGENT,
      Accept: 'application/json',
    },
  });
  if (!res.ok) throw new Error(`Reddit ${res.status}: ${path}`);
  return res.json();
}

export async function scrapeReddit(filmId: number, film: TmdbFilm): Promise<Chunk[]> {
  const year = getFilmYear(film);
  const query = encodeURIComponent(`${film.title} ${year}`);

  const posts: RedditPost[] = [];

  // Search film-focused subreddits
  const subreddits = ['movies', 'TrueFilm', 'flicks'];
  for (const sub of subreddits) {
    try {
      const data = await redditGet<RedditListing<RedditPost>>(
        `/r/${sub}/search.json?q=${query}&sort=relevance&limit=5&restrict_sr=true`
      );
      const found = data.data.children
        .filter((c) => c.kind === 't3' && c.data.score > 5)
        .map((c) => c.data);
      posts.push(...found.slice(0, 2));
    } catch {
      // Subreddit unavailable — continue
    }
  }

  // Fallback: site-wide search
  if (!posts.length) {
    try {
      const data = await redditGet<RedditListing<RedditPost>>(
        `/search.json?q=${query}+film&sort=relevance&limit=10&type=link`
      );
      const found = data.data.children
        .filter((c) => c.kind === 't3' && c.data.score > 10)
        .map((c) => c.data);
      posts.push(...found.slice(0, 5));
    } catch {
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

    // Fetch top comments via public .json endpoint
    try {
      const commentData = await redditGet<[unknown, RedditListing<RedditComment>]>(
        `${post.permalink}.json?depth=1&limit=30`
      );
      const comments = commentData[1].data.children
        .filter(
          (c) =>
            c.kind === 't1' &&
            typeof c.data.body === 'string' &&
            c.data.body !== '[removed]' &&
            c.data.body !== '[deleted]' &&
            c.data.score >= 10 &&
            c.data.body.length > 50
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
