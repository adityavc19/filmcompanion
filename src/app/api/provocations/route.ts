import { NextRequest, NextResponse } from "next/server";
import { google } from "@ai-sdk/google";
import { generateText } from "ai";
import { getFilmDetails, director, year } from "@/lib/tmdb";
import { setWithCap } from "@/lib/cache";
import { rateLimit } from "@/lib/rate-limit";
import type { FilmProvocations, ProvocationCard } from "@/lib/cards";

// Node runtime — do NOT switch to edge. The in-memory cache below relies on
// a long-lived module scope that edge runtime does not provide.
const cache = new Map<string, { data: FilmProvocations; ts: number }>();
const CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days
const CACHE_MAX = 200;

function isString(v: unknown): v is string {
  return typeof v === "string";
}

function validateCard(v: unknown): ProvocationCard | null {
  if (!v || typeof v !== "object") return null;
  const o = v as Record<string, unknown>;
  if (
    typeof o.id !== "number" ||
    !isString(o.type) ||
    !isString(o.provocation) ||
    typeof o.hasSlider !== "boolean" ||
    !isString(o.writePlaceholder)
  ) {
    return null;
  }
  const card: ProvocationCard = {
    id: o.id,
    type: o.type,
    provocation: o.provocation,
    hasSlider: o.hasSlider,
    writePlaceholder: o.writePlaceholder,
    leftPole: isString(o.leftPole) ? o.leftPole : undefined,
    rightPole: isString(o.rightPole) ? o.rightPole : undefined,
  };
  if (o.nudges && typeof o.nudges === "object") {
    const n = o.nudges as Record<string, unknown>;
    if (isString(n.low) && isString(n.mid) && isString(n.high)) {
      card.nudges = { low: n.low, mid: n.mid, high: n.high };
    }
  }
  return card;
}

function validateProvocations(v: unknown): FilmProvocations | null {
  if (!v || typeof v !== "object") return null;
  const o = v as Record<string, unknown>;
  if (!isString(o.hookText) || !isString(o.dataPoint) || !Array.isArray(o.cards)) {
    return null;
  }
  const cards: ProvocationCard[] = [];
  for (const raw of o.cards) {
    const card = validateCard(raw);
    if (!card) return null;
    cards.push(card);
  }
  if (cards.length === 0) return null;
  return { hookText: o.hookText, dataPoint: o.dataPoint, cards };
}

export async function GET(req: NextRequest) {
  const limited = await rateLimit(req, { limit: 20, windowMs: 60_000, key: "provocations" });
  if (limited) return limited;

  const filmId = req.nextUrl.searchParams.get("filmId");
  if (!filmId) {
    return NextResponse.json({ error: "filmId required" }, { status: 400 });
  }

  // Check server cache
  const cached = cache.get(filmId);
  if (cached && Date.now() - cached.ts < CACHE_TTL_MS) {
    return NextResponse.json(cached.data, {
      headers: { "X-Cache": "HIT" },
    });
  }

  const film = await getFilmDetails(Number(filmId));
  if (!film) {
    return NextResponse.json({ error: "Film not found" }, { status: 404 });
  }

  const filmDir = director(film);
  const filmYear = year(film.release_date);
  const genres = film.genres?.map((g) => g.name).join(", ") ?? "";
  const cast = film.credits?.cast
    .slice(0, 5)
    .map((c) => c.name)
    .join(", ") ?? "";

  const prompt = `You are generating provocation cards for a film discussion app. The film is:

Title: ${film.title} (${filmYear})
Director: ${filmDir}
Genres: ${genres}
Cast: ${cast}
Synopsis: ${film.overview}
TMDB Rating: ${film.vote_average}/10

Generate exactly this JSON structure (no markdown, no code fences, just raw JSON):

{
  "hookText": "A 1-2 sentence provocative hook about this film that makes someone want to take a position. Reference real discourse, awards, or controversy if applicable. Sharp, not academic.",
  "dataPoint": "A data-style line like 'Critics: X% — Audiences: Y% — [insight about the gap]'. Use approximate real numbers if known, or reference rating polarization.",
  "cards": [
    {
      "id": 1,
      "type": "THE TAKE",
      "provocation": "2-4 sentences. The central discourse split about this film. What do people disagree about most? Be specific — reference scenes, choices, reception. Sharp friend voice, not film professor.",
      "leftPole": "Short label (2-4 words) for one side",
      "rightPole": "Short label (2-4 words) for the other side",
      "hasSlider": true,
      "nudges": {
        "low": "A one-liner acknowledging they picked the left position. Reference real discourse.",
        "mid": "A one-liner for the middle position. Note that it's rare or interesting.",
        "high": "A one-liner acknowledging they picked the right position. Reference real discourse."
      },
      "writePlaceholder": "Short prompt to encourage writing"
    },
    {
      "id": 2,
      "type": "THE SPECIFIC",
      "provocation": "2-4 sentences about a specific scene, moment, or directorial choice that generated discussion. Get the user remembering.",
      "leftPole": "One reading of the moment",
      "rightPole": "The opposite reading",
      "hasSlider": true,
      "nudges": {
        "low": "Contextual one-liner for left position",
        "mid": "Contextual one-liner for middle",
        "high": "Contextual one-liner for right position"
      },
      "writePlaceholder": "Short prompt"
    },
    {
      "id": 3,
      "type": "THE CONTRARIAN",
      "provocation": "2-4 sentences presenting the strongest case against consensus opinion on this film. Challenge the user to defend their view.",
      "leftPole": "Agrees with the contrarian take",
      "rightPole": "Disagrees with the contrarian take",
      "hasSlider": true,
      "nudges": {
        "low": "Contextual one-liner",
        "mid": "Contextual one-liner",
        "high": "Contextual one-liner that pushes them to articulate why"
      },
      "writePlaceholder": "Short prompt that encourages writing"
    },
    {
      "id": 4,
      "type": "OPEN PROMPT",
      "provocation": "Anything else sitting with you about ${film.title}? A scene, a feeling, something you can't shake.",
      "hasSlider": false,
      "writePlaceholder": "The thing the cards didn't ask about..."
    }
  ]
}

Rules:
- Be specific to THIS film. Reference actual scenes, characters, directorial choices.
- Voice: sharp friend who watched the same film, not a film studies professor.
- Provocations must make someone feel compelled to take a position — if you can shrug, it's too soft.
- Ground everything in real discourse when possible.
- Return ONLY valid JSON. No explanation, no markdown fences.`;

  try {
    const { text } = await generateText({
      model: google("gemini-2.0-flash"),
      prompt,
      temperature: 0.7,
    });

    const cleaned = text.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
    const parsed = JSON.parse(cleaned);
    const provocations = validateProvocations(parsed);
    if (!provocations) {
      console.error("Provocation shape validation failed:", parsed);
      return NextResponse.json(
        { error: "Malformed provocation response" },
        { status: 502 }
      );
    }

    setWithCap(cache, filmId, { data: provocations, ts: Date.now() }, CACHE_MAX);

    return NextResponse.json(provocations, {
      headers: { "X-Cache": "MISS" },
    });
  } catch (err) {
    console.error("Provocation generation failed:", err);
    return NextResponse.json(
      { error: "Failed to generate provocations" },
      { status: 500 }
    );
  }
}
