import type { Chunk } from '@/types';

const STOPWORDS = new Set([
  'the', 'a', 'an', 'is', 'was', 'are', 'were', 'be', 'been', 'being',
  'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could',
  'should', 'may', 'might', 'shall', 'can', 'that', 'this', 'these',
  'those', 'it', 'its', 'of', 'in', 'on', 'at', 'to', 'for', 'with',
  'by', 'from', 'up', 'about', 'into', 'through', 'and', 'or', 'but',
  'if', 'as', 'not', 'what', 'which', 'who', 'how', 'why', 'when',
  'where', 'all', 'just', 'so', 'very', 'film', 'movie',
]);

function tokenize(text: string): Set<string> {
  return new Set(
    text
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, ' ')
      .split(/\s+/)
      .filter((t) => t.length > 2 && !STOPWORDS.has(t))
  );
}

function scoreChunk(queryTokens: Set<string>, chunk: Chunk): number {
  const chunkTokens = tokenize(chunk.text);
  let overlap = 0;
  for (const token of queryTokens) {
    if (chunkTokens.has(token)) overlap++;
  }
  // Base score: token overlap ratio
  let score = overlap / Math.max(queryTokens.size, 1);

  // Bonus: exact substring match (case-insensitive)
  const lowerText = chunk.text.toLowerCase();
  const lowerQuery = Array.from(queryTokens).join(' ');
  if (lowerQuery.length > 3 && lowerText.includes(lowerQuery)) {
    score += 0.5;
  }

  return score;
}

export function retrieveChunks(
  query: string,
  chunks: Chunk[],
  topN: number = 7
): Chunk[] {
  if (!chunks.length) return [];
  const queryTokens = tokenize(query);
  if (queryTokens.size === 0) {
    // No meaningful tokens — return a spread across sources
    return chunks.slice(0, topN);
  }

  const scored = chunks.map((chunk) => ({
    chunk,
    score: scoreChunk(queryTokens, chunk),
  }));

  return scored
    .sort((a, b) => b.score - a.score)
    .slice(0, topN)
    .map((s) => s.chunk);
}
