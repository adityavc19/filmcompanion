import { anthropic } from "@ai-sdk/anthropic";
import { streamText } from "ai";
import { ANORA_CARDS } from "@/lib/cards";

export const runtime = "edge";

function buildSystemPrompt(positions: number[], texts: string[]): string {
  const positionDescriptions = ANORA_CARDS.filter((c) => c.hasSlider).map(
    (card, i) => {
      const pos = positions[i];
      const label =
        pos < 30
          ? `strongly leans ${card.leftPole?.toLowerCase()}`
          : pos < 45
          ? `leans ${card.leftPole?.toLowerCase()}`
          : pos <= 55
          ? "in the middle"
          : pos <= 70
          ? `leans ${card.rightPole?.toLowerCase()}`
          : `strongly leans ${card.rightPole?.toLowerCase()}`;

      let line = `- Card ${card.id} (${card.type}: ${card.leftPole} ↔ ${card.rightPole}): ${pos}/100 (${label})`;
      if (texts[i]) {
        line += `\n  Written reaction: "${texts[i]}"`;
      }
      return line;
    }
  );

  const openPromptText = texts[3];

  return `You are Film Companion, discussing Anora (2024, dir. Sean Baker) with a user who just completed a provocation sequence. Their positions:

${positionDescriptions.join("\n")}
${openPromptText ? `\nOpen reflection: "${openPromptText}"` : ""}
${positions.length > 0 ? `\nStar rating: provided separately in conversation` : ""}

Your role: help the user process and discuss Anora the way they would with a thoughtful friend who has also seen it and read deeply about it.

Rules:
- Assume the user has watched the full film. Spoilers are fine.
- Be specific — reference actual scenes, characters, dialogue.
- Find the TENSION between their positions, not just summarize them.
- Surface disagreements between sources honestly: "Letterboxd reviewers felt..." not footnotes.
- Don't summarise the plot unless asked. They know it.
- Match the user's register: analytical, emotional, casual — follow their lead.
- Keep responses concise (2-4 paragraphs max). This is a conversation, not an essay.
- Reference their specific positions when relevant, but don't parrot them back.`;
}

export async function POST(req: Request) {
  const { messages, positions, texts } = await req.json();

  const result = streamText({
    model: anthropic("claude-sonnet-4-20250514"),
    system: buildSystemPrompt(positions ?? [], texts ?? []),
    messages,
    maxOutputTokens: 800,
  });

  return result.toTextStreamResponse();
}
