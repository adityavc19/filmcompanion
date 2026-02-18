import { getFilm } from '@/lib/knowledge-store';
import { retrieveChunks } from '@/lib/rag';
import { streamChatResponse } from '@/lib/claude';
import type { ChatMessage, SourceName } from '@/types';

export const runtime = 'nodejs';
export const maxDuration = 60;

const SSE_HEADERS = {
  'Content-Type': 'text/event-stream',
  'Cache-Control': 'no-cache, no-transform',
  Connection: 'keep-alive',
  'X-Accel-Buffering': 'no',
};

export async function POST(request: Request) {
  const { filmId, messages } = (await request.json()) as {
    filmId: number;
    messages: ChatMessage[];
  };

  const knowledge = getFilm(filmId);
  if (!knowledge) {
    return Response.json({ error: 'Film not ingested yet' }, { status: 404 });
  }

  const lastUserMessage = messages.at(-1)?.content ?? '';
  const relevantChunks = retrieveChunks(lastUserMessage, knowledge.chunks);
  const sources = [...new Set(relevantChunks.map((c) => c.source))] as SourceName[];

  const stream = new ReadableStream({
    async start(controller) {
      const encoder = new TextEncoder();
      const send = (data: object) => {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
      };

      try {
        for await (const text of streamChatResponse(messages, relevantChunks, knowledge)) {
          send({ text });
        }
        send({ done: true, sources });
      } catch (err) {
        console.error('Chat stream error:', err);
        send({ error: 'Something went wrong. Please try again.' });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, { headers: SSE_HEADERS });
}
