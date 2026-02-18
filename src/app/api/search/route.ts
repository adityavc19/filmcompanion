import { searchFilms } from '@/lib/tmdb';

export const runtime = 'nodejs';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const q = searchParams.get('q')?.trim();

  if (!q || q.length < 2) {
    return Response.json([], {
      headers: { 'Cache-Control': 'no-store' },
    });
  }

  try {
    const results = await searchFilms(q);
    return Response.json(results.slice(0, 8), {
      headers: { 'Cache-Control': 'no-store' },
    });
  } catch (err) {
    console.error('Search error:', err);
    return Response.json([], { status: 500 });
  }
}
