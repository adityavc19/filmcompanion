import { google } from "@ai-sdk/google";
import { streamText } from "ai";

export const runtime = "edge";

function buildSystemPrompt(
  filmTitle: string,
  filmYear: string,
  positions: number[],
  texts: string[],
  cardLabels: { type: string; leftPole?: string; rightPole?: string }[]
): string {
  const positionDescriptions = cardLabels
    .filter((c) => c.leftPole && c.rightPole)
    .map((card, i) => {
      const pos = positions[i];
      if (pos < 0) return null;
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

      let line = `- ${card.type} (${card.leftPole} ↔ ${card.rightPole}): ${pos}/100 (${label})`;
      if (texts[i]) {
        line += `\n  Written reaction: "${texts[i]}"`;
      }
      return line;
    })
    .filter(Boolean);

  const openPromptText = texts[3];

  return `You are Film Companion, discussing ${filmTitle} (${filmYear}) with a user who just completed a provocation sequence. Their positions:

${positionDescriptions.join("\n")}
${openPromptText ? `\nOpen reflection: "${openPromptText}"` : ""}

Your role: help the user process and discuss this film the way they would with a thoughtful friend who has also seen it and read deeply about it.

Rules:
- Assume the user has watched the full film. Spoilers are fine.
- Be specific — reference actual scenes, characters, dialogue.
- Find the TENSION between their positions, not just summarize them.
- Don't summarise the plot unless asked. They know it.
- Match the user's register: analytical, emotional, casual — follow their lead.
- Keep responses concise (2-4 paragraphs max). This is a conversation, not an essay.`;
}

export async function POST(req: Request) {
  const { messages, filmTitle, filmYear, positions, texts, cardLabels } =
    await req.json();

  const result = streamText({
    model: google("gemini-2.0-flash"),
    system: buildSystemPrompt(
      filmTitle ?? "Unknown",
      filmYear ?? "",
      positions ?? [],
      texts ?? [],
      cardLabels ?? []
    ),
    messages,
    maxOutputTokens: 800,
  });

  return result.toTextStreamResponse();
}
