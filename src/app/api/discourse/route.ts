import { NextRequest, NextResponse } from "next/server";
import { google } from "@ai-sdk/google";
import { generateText } from "ai";
import { getFilmDetails, director, year } from "@/lib/tmdb";

// Server-side cache: filmId → { data, timestamp }
const cache = new Map<string, { data: unknown; ts: number }>();
const CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

export async function GET(req: NextRequest) {
  const filmId = req.nextUrl.searchParams.get("filmId");
  if (!filmId) {
    return NextResponse.json({ error: "filmId required" }, { status: 400 });
  }

  // Check cache
  const cached = cache.get(`discourse_${filmId}`);
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
  const cast =
    film.credits?.cast
      .slice(0, 5)
      .map((c) => c.name)
      .join(", ") ?? "";

  const prompt = `You are a film discourse analyst. Synthesize the critical and audience conversation around this film:

Title: ${film.title} (${filmYear})
Director: ${filmDir}
Genres: ${genres}
Cast: ${cast}
Synopsis: ${film.overview}
TMDB Rating: ${film.vote_average}/10

Generate a JSON object with this exact structure (no markdown, no code fences, just raw JSON):

{
  "critics": "2-4 sentences synthesizing the critical consensus and notable dissent. Reference real critics or publications when possible. What do professional reviewers praise and what do they criticize? Be specific about craft elements — cinematography, writing, performances, pacing.",
  "audiences": "2-4 sentences synthesizing audience reception. How does the general audience response differ from critics? What resonates or falls flat with regular viewers? Reference Letterboxd, Reddit, or common audience talking points.",
  "tension": "1-2 sentences capturing the CENTRAL TENSION in discourse about this film. The one thing that divides opinion most sharply. This should read like a pull-quote — provocative and specific.",
  "letterboxdRating": "Estimated Letterboxd average (e.g. '3.8' out of 5). Use your best estimate based on the film's reception.",
  "tomatometer": "Estimated Rotten Tomatoes critics score (e.g. '92%'). Use your best estimate.",
  "audienceScore": "Estimated RT audience score (e.g. '79%'). Use your best estimate.",
  "sourcesUsed": ["letterboxd", "rottentomatoes", "reddit", "youtube"],
  "starterChips": [
    "A thought-provoking question about the most debated aspect of this film",
    "A question about a specific scene or directorial choice that generated discussion",
    "A question connecting this film to the director's broader work or the genre",
    "A question about the film's themes or cultural significance"
  ]
}

Rules:
- Be specific to THIS film. Don't give generic film criticism.
- Voice: informed, opinionated, specific — like a film-literate friend at a bar.
- The tension pull-quote should make someone want to respond.
- Starter chips should be genuine conversation starters, not essay prompts.
- Return ONLY valid JSON. No explanation, no markdown fences.`;

  try {
    const { text } = await generateText({
      model: google("gemini-2.0-flash"),
      prompt,
      temperature: 0.7,
    });

    const cleaned = text
      .replace(/```json\n?/g, "")
      .replace(/```\n?/g, "")
      .trim();
    const discourse = JSON.parse(cleaned);

    // Cache
    cache.set(`discourse_${filmId}`, { data: discourse, ts: Date.now() });

    return NextResponse.json(discourse, {
      headers: { "X-Cache": "MISS" },
    });
  } catch (err) {
    console.error("Discourse generation failed:", err);
    return NextResponse.json(
      { error: "Failed to generate discourse" },
      { status: 500 }
    );
  }
}
