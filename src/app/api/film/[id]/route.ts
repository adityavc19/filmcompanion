import { NextRequest, NextResponse } from "next/server";
import { getFilmDetails, director, year } from "@/lib/tmdb";

interface Params {
  params: Promise<{ id: string }>;
}

export async function GET(_req: NextRequest, { params }: Params) {
  const { id } = await params;
  const idNum = Number(id);
  if (!Number.isFinite(idNum) || idNum <= 0) {
    return NextResponse.json({ error: "invalid id" }, { status: 400 });
  }

  const film = await getFilmDetails(idNum);
  if (!film) {
    return NextResponse.json({ error: "Film not found" }, { status: 404 });
  }

  return NextResponse.json({
    title: film.title,
    year: year(film.release_date),
    director: director(film),
    posterPath: film.poster_path,
    backdropPath: film.backdrop_path,
    runtime: film.runtime ?? null,
    overview: film.overview,
    voteAverage: film.vote_average,
    genres: film.genres?.map((g) => g.name) ?? [],
    cast: film.credits?.cast.slice(0, 5).map((c) => c.name) ?? [],
  });
}
