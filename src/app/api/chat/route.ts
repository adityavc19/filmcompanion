import { google } from "@ai-sdk/google";
import { streamText } from "ai";
import { type NextRequest, NextResponse } from "next/server";
import { rateLimit } from "@/lib/rate-limit";

export const runtime = "edge";

const MAX_MESSAGES = 30;
const MAX_CONTENT_CHARS = 4000;
const MAX_TEXT_CHARS = 600;

interface IncomingMessage {
  role: "user" | "assistant";
  content: string;
}

interface CardLabel {
  type: string;
  leftPole?: string;
  rightPole?: string;
}

interface ChatBody {
  messages: IncomingMessage[];
  filmTitle: string;
  filmYear: string;
  positions: number[];
  texts: string[];
  cardLabels: CardLabel[];
}

function isString(v: unknown): v is string {
  return typeof v === "string";
}

function validateBody(raw: unknown): ChatBody | string {
  if (!raw || typeof raw !== "object") return "body must be an object";
  const o = raw as Record<string, unknown>;

  if (!Array.isArray(o.messages)) return "messages must be an array";
  if (o.messages.length === 0) return "messages cannot be empty";
  if (o.messages.length > MAX_MESSAGES) return `messages exceeds ${MAX_MESSAGES}`;

  const messages: IncomingMessage[] = [];
  for (const m of o.messages) {
    if (!m || typeof m !== "object") return "message must be an object";
    const mo = m as Record<string, unknown>;
    if (mo.role !== "user" && mo.role !== "assistant") {
      return "message.role must be user or assistant";
    }
    if (!isString(mo.content)) return "message.content must be a string";
    if (mo.content.length > MAX_CONTENT_CHARS) {
      return `message.content exceeds ${MAX_CONTENT_CHARS} chars`;
    }
    messages.push({ role: mo.role, content: mo.content });
  }

  const positions = Array.isArray(o.positions)
    ? o.positions.filter((n): n is number => typeof n === "number").slice(0, 10)
    : [];
  const texts = Array.isArray(o.texts)
    ? o.texts
        .filter(isString)
        .map((t) => (t.length > MAX_TEXT_CHARS ? t.slice(0, MAX_TEXT_CHARS) : t))
        .slice(0, 10)
    : [];
  const cardLabels = Array.isArray(o.cardLabels)
    ? o.cardLabels
        .filter((c): c is CardLabel => {
          if (!c || typeof c !== "object") return false;
          const co = c as Record<string, unknown>;
          return (
            isString(co.type) &&
            (co.leftPole === undefined || isString(co.leftPole)) &&
            (co.rightPole === undefined || isString(co.rightPole))
          );
        })
        .slice(0, 10)
    : [];

  return {
    messages,
    filmTitle: isString(o.filmTitle) ? o.filmTitle.slice(0, 200) : "Unknown",
    filmYear: isString(o.filmYear) ? o.filmYear.slice(0, 10) : "",
    positions,
    texts,
    cardLabels,
  };
}

function buildSystemPrompt(
  filmTitle: string,
  filmYear: string,
  positions: number[],
  texts: string[],
  cardLabels: CardLabel[]
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

      // JSON.stringify wraps and escapes user input safely — closes the
      // prompt-injection hole where a `"` in texts[i] would break out of
      // the surrounding quotes in the system prompt.
      const safeType = JSON.stringify(card.type);
      const safeLeft = JSON.stringify(card.leftPole);
      const safeRight = JSON.stringify(card.rightPole);
      let line = `- ${safeType} (${safeLeft} ↔ ${safeRight}): ${pos}/100 (${label})`;
      if (texts[i]) {
        line += `\n  Written reaction: ${JSON.stringify(texts[i])}`;
      }
      return line;
    })
    .filter(Boolean);

  const openPromptText = texts[3];
  const safeTitle = JSON.stringify(filmTitle);

  return `You are Film Companion, discussing ${safeTitle} (${filmYear}) with a user who just completed a provocation sequence. Their positions:

${positionDescriptions.join("\n")}
${openPromptText ? `\nOpen reflection: ${JSON.stringify(openPromptText)}` : ""}

Your role: help the user process and discuss this film the way they would with a thoughtful friend who has also seen it and read deeply about it.

Rules:
- Assume the user has watched the full film. Spoilers are fine.
- Be specific — reference actual scenes, characters, dialogue.
- Find the TENSION between their positions, not just summarize them.
- Don't summarise the plot unless asked. They know it.
- Match the user's register: analytical, emotional, casual — follow their lead.
- Keep responses concise (2-4 paragraphs max). This is a conversation, not an essay.`;
}

export async function POST(req: NextRequest) {
  const limited = await rateLimit(req, { limit: 30, windowMs: 60_000, key: "chat" });
  if (limited) return limited;

  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid JSON" }, { status: 400 });
  }

  const body = validateBody(raw);
  if (typeof body === "string") {
    return NextResponse.json({ error: body }, { status: 400 });
  }

  const result = streamText({
    model: google("gemini-2.0-flash"),
    system: buildSystemPrompt(
      body.filmTitle,
      body.filmYear,
      body.positions,
      body.texts,
      body.cardLabels
    ),
    messages: body.messages,
    maxOutputTokens: 800,
  });

  return result.toTextStreamResponse();
}
