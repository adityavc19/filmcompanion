import { getFilm, loadFromDb } from '@/lib/knowledge-store';

export const runtime = 'nodejs';

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const filmId = parseInt(id, 10);
  if (isNaN(filmId)) {
    return Response.json({ error: 'Invalid film ID' }, { status: 400 });
  }

  // L1: in-memory
  let knowledge = getFilm(filmId);

  // L2: Supabase — load into memory if not found
  if (!knowledge) {
    await loadFromDb(filmId);
    knowledge = getFilm(filmId);
  }

  if (!knowledge) {
    return Response.json({ error: 'Film not found' }, { status: 404 });
  }

  // Return serializable subset (exclude raw chunks to keep response small)
  return Response.json({
    filmId: knowledge.filmId,
    tmdbData: knowledge.tmdbData,
    sentiment: knowledge.sentiment,
    starterChips: knowledge.starterChips,
    sourcesLoaded: knowledge.sourcesLoaded,
    chunkCount: knowledge.chunks.length,
  });
}
