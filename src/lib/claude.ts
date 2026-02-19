import Anthropic from '@anthropic-ai/sdk';
import type { Chunk, ChatMessage, FilmKnowledge } from '@/types';
import { extractDirector, getFilmYear } from '@/lib/tmdb';

const MODEL = 'claude-sonnet-4-6';

let _client: Anthropic | null = null;
function getClient(): Anthropic {
  if (!_client) _client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  return _client;
}

export function buildSystemPrompt(knowledge: FilmKnowledge): string {
  const { tmdbData, sourcesLoaded, sentiment, chunks } = knowledge;
  const director = extractDirector(tmdbData) ?? 'Unknown';
  const year = getFilmYear(tmdbData);
  const runtime = tmdbData.runtime ? `${tmdbData.runtime} min` : 'N/A';
  const genres = tmdbData.genres.map((g) => g.name).join(', ');
  const chunkCount = chunks.length;

  const sourcesList = sourcesLoaded
    .filter((s) => s !== 'tmdb')
    .map((s) => {
      const labels: Record<string, string> = {
        letterboxd: 'Letterboxd reviews',
        reddit: 'Reddit discussions',
        rottentomatoes: 'Rotten Tomatoes critical consensus',
        youtube: 'YouTube video essay transcripts',
      };
      return labels[s] ?? s;
    })
    .join(', ');

  return `You are a film companion for ${tmdbData.title} (${year}).

Film details: Directed by ${director} | ${runtime} | ${genres}
${sentiment.letterboxdRating ? `Letterboxd rating: ${sentiment.letterboxdRating}` : ''}
${sentiment.tomatometer ? `Rotten Tomatoes: ${sentiment.tomatometer}` : ''}

You have access to ${chunkCount} chunks of content from: TMDB synopsis${sourcesList ? `, ${sourcesList}` : ''}.

Your role: help the user process and discuss this film the way they would with a thoughtful friend who has also seen it and read deeply about it.

Rules:
- Assume the user has watched the full film. Spoilers are fine.
- Be specific — reference actual scenes, characters, dialogue when relevant.
- Surface disagreements between sources honestly when they exist.
- Cite sources naturally: "Letterboxd reviewers felt..." or "A Reddit thread argued..." — not footnotes.
- Don't summarise the plot unless asked. They've seen it.
- Match the user's register: analytical, emotional, casual — follow their lead.
- Keep responses focused and conversational, not encyclopedic.`;
}

function formatChunksForContext(chunks: Chunk[]): string {
  if (!chunks.length) return '';

  const sourceLabels: Record<string, string> = {
    tmdb: 'TMDB',
    letterboxd: 'LETTERBOXD',
    reddit: 'REDDIT',
    rottentomatoes: 'ROTTEN TOMATOES',
    youtube: 'YOUTUBE ESSAY',
  };

  return chunks
    .map((c) => `[${sourceLabels[c.source] ?? c.source.toUpperCase()}]\n${c.text}`)
    .join('\n\n---\n\n');
}

function trimConversation(messages: ChatMessage[]): ChatMessage[] {
  if (messages.length <= 10) return messages;
  return messages.slice(-10);
}

export async function* streamChatResponse(
  messages: ChatMessage[],
  relevantChunks: Chunk[],
  knowledge: FilmKnowledge
): AsyncGenerator<string> {
  const systemPrompt = buildSystemPrompt(knowledge);
  const contextBlock = formatChunksForContext(relevantChunks);
  const trimmedMessages = trimConversation(messages);

  // Inject RAG context into the final user message
  const lastMessage = trimmedMessages.at(-1)!;
  const lastUserContent = contextBlock
    ? `Here is relevant context from reviews, discussions, and criticism:\n\n${contextBlock}\n\n---\n\nWith that context in mind: ${lastMessage.content}`
    : lastMessage.content;

  const anthropicMessages: Anthropic.MessageParam[] = [
    ...trimmedMessages.slice(0, -1).map((m) => ({
      role: m.role as 'user' | 'assistant',
      content: m.content,
    })),
    { role: 'user', content: lastUserContent },
  ];

  const response = await getClient().messages.create({
    model: MODEL,
    max_tokens: 1024,
    system: systemPrompt,
    messages: anthropicMessages,
    stream: true,
  });

  for await (const event of response) {
    if (
      event.type === 'content_block_delta' &&
      event.delta.type === 'text_delta' &&
      event.delta.text
    ) {
      yield event.delta.text;
    }
  }
}

export async function generateDerivedContent(
  knowledge: FilmKnowledge
): Promise<{ sentiment: { critics: string; audiences: string; tension: string }; chips: string[] }> {
  const sampleChunks = knowledge.chunks.slice(0, 8);
  const contextText = sampleChunks.map((c) => `[${c.source}] ${c.text}`).join('\n\n');

  const prompt = `Based on these reviews and discussions about "${knowledge.tmdbData.title}" (${getFilmYear(knowledge.tmdbData)}), provide:

1. A 1-2 sentence summary of what critics think
2. A 1-2 sentence summary of what general audiences think
3. A 1 sentence description of the main tension or disagreement between critics and audiences
4. Three specific, provocative discussion questions based on what reviewers actually argued about

Return valid JSON only, with this exact structure:
{
  "critics": "...",
  "audiences": "...",
  "tension": "...",
  "chips": ["question 1?", "question 2?", "question 3?"]
}

Context:
${contextText}`;

  try {
    const response = await getClient().messages.create({
      model: MODEL,
      max_tokens: 512,
      messages: [{ role: 'user', content: prompt }],
    });

    const text = response.content[0].type === 'text' ? response.content[0].text : '';
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error('No JSON in response');
    const parsed = JSON.parse(jsonMatch[0]);

    return {
      sentiment: {
        critics: parsed.critics ?? '',
        audiences: parsed.audiences ?? '',
        tension: parsed.tension ?? '',
      },
      chips: Array.isArray(parsed.chips) ? parsed.chips.slice(0, 3) : [],
    };
  } catch {
    return {
      sentiment: {
        critics: "Critics have noted the film's unique vision and craft.",
        audiences: 'Audience reactions vary — some find it deeply moving, others challenging.',
        tension: 'The main divide is between those who embrace its ambiguity and those who want clarity.',
      },
      chips: [
        'What does the ending actually mean?',
        'What was the director trying to say?',
        'Why do critics and audiences disagree so sharply?',
      ],
    };
  }
}
