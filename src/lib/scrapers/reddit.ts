import { chunkText } from '@/lib/chunker';
import type { Chunk, TmdbFilm } from '@/types';
import { getFilmYear } from '@/lib/tmdb';

const REDDIT_TOKEN_URL = 'https://www.reddit.com/api/v1/access_token';
const REDDIT_API_BASE = 'https://oauth.reddit.com';

let cachedToken: { token: string; expiresAt: number } | null = null;

async function getAccessToken(): Promise<string> {
  if (cachedToken && Date.now() < cachedToken.expiresAt) {
    return cachedToken.token;
  }

  const clientId = process.env.REDDIT_CLIENT_ID!;
  const clientSecret = process.env.REDDIT_CLIENT_SECRET!;
  const userAgent = process.env.REDDIT_USER_AGENT ?? 'FilmCompanion/1.0';

  const credentials = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');

  const res = await fetch(REDDIT_TOKEN_URL, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${credentials}`,
      'Content-Type': 'application/x-www-form-urlencoded',
      'User-Agent': userAgent,
    },
    body: 'grant_type=client_credentials',
  });

  if (!res.ok) throw new Error(`Reddit auth failed: ${res.status}`);
  const data = await res.json();

  cachedToken = {
    token: data.access_token,
    expiresAt: Date.now() + (data.expires_in - 60) * 1000,
  };

  return cachedToken.token;
}

async function redditFetch<T>(path: string, token: string): Promise<T> {
  const userAgent = process.env.REDDIT_USER_AGENT ?? 'FilmCompanion/1.0';
  const res = await fetch(`${REDDIT_API_BASE}${path}`, {
    headers: {
      Authorization: `Bearer ${token}`,
      'User-Agent': userAgent,
    },
  });
  if (!res.ok) throw new Error(`Reddit API error ${res.status}: ${path}`);
  return res.json();
}

interface RedditPost {
  data: {
    id: string;
    title: string;
    selftext: string;
    score: number;
    url: string;
  };
}

interface RedditComment {
  data: {
    body: string;
    score: number;
    replies?: { data: { children: { kind: string; data: RedditComment['data'] }[] } } | '';
  };
}

interface RedditListing<T> {
  data: { children: { kind: string; data: T }[] };
}

export async function scrapeReddit(filmId: number, film: TmdbFilm): Promise<Chunk[]> {
  if (!process.env.REDDIT_CLIENT_ID || !process.env.REDDIT_CLIENT_SECRET ||
      process.env.REDDIT_CLIENT_ID === 'your_reddit_client_id') {
    console.log('Reddit: credentials not configured, skipping');
    return [];
  }
  const token = await getAccessToken();
  const year = getFilmYear(film);
  const query = encodeURIComponent(`${film.title} ${year}`);

  // Search multiple subreddits
  const subreddits = ['movies', 'TrueFilm', 'flicks'];
  const posts: RedditPost['data'][] = [];

  for (const sub of subreddits) {
    try {
      const data = await redditFetch<RedditListing<RedditPost['data']>>(
        `/r/${sub}/search?q=${query}&sort=relevance&limit=5&restrict_sr=true&type=link`,
        token
      );
      const found = data.data.children
        .filter((c) => c.kind === 't3' && c.data.score > 5)
        .map((c) => c.data);
      posts.push(...found.slice(0, 2));
    } catch {
      // Sub unavailable — continue
    }
  }

  if (!posts.length) {
    // Broader search across all Reddit
    try {
      const data = await redditFetch<RedditListing<RedditPost['data']>>(
        `/search?q=${query}+film&sort=relevance&limit=10&type=link`,
        token
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

    // Fetch comments
    try {
      const commentData = await redditFetch<[unknown, RedditListing<RedditComment['data']>]>(
        `/comments/${post.id}?depth=1&limit=30`,
        token
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

  const combined = allText.join('\n\n---\n\n');
  return chunkText(combined, filmId, 'reddit');
}
