import type { Chunk, SourceName } from '@/types';

const CHUNK_SIZE_CHARS = 1800; // ~450 tokens

export function chunkText(
  text: string,
  filmId: number,
  source: SourceName,
  metadata?: Record<string, string | number>
): Chunk[] {
  if (!text?.trim()) return [];

  // Split on paragraph boundaries first
  const paragraphs = text.split(/\n\n+/).filter((p) => p.trim().length > 20);

  const chunks: Chunk[] = [];
  let current = '';
  let chunkIndex = 0;

  for (const para of paragraphs) {
    if (current.length + para.length > CHUNK_SIZE_CHARS && current.length > 0) {
      chunks.push({
        id: `${filmId}-${source}-${chunkIndex++}`,
        filmId,
        source,
        text: current.trim(),
        metadata,
      });
      current = '';
    }
    // If single paragraph exceeds limit, hard-split at sentence boundary
    if (para.length > CHUNK_SIZE_CHARS) {
      const sentences = para.match(/[^.!?]+[.!?]+/g) ?? [para];
      for (const sentence of sentences) {
        if (current.length + sentence.length > CHUNK_SIZE_CHARS && current.length > 0) {
          chunks.push({
            id: `${filmId}-${source}-${chunkIndex++}`,
            filmId,
            source,
            text: current.trim(),
            metadata,
          });
          current = '';
        }
        current += sentence + ' ';
      }
    } else {
      current += para + '\n\n';
    }
  }

  if (current.trim().length > 20) {
    chunks.push({
      id: `${filmId}-${source}-${chunkIndex++}`,
      filmId,
      source,
      text: current.trim(),
      metadata,
    });
  }

  return chunks;
}
