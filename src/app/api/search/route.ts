import { NextRequest, NextResponse } from "next/server";
import { searchFilms } from "@/lib/tmdb";

export async function GET(req: NextRequest) {
  const query = req.nextUrl.searchParams.get("q");
  if (!query || query.length < 2) {
    return NextResponse.json([]);
  }
  const results = await searchFilms(query);
  return NextResponse.json(results);
}
