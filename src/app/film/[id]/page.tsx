import Image from "next/image";
import Link from "next/link";
import { getFilmDetails, posterUrl, year, director } from "@/lib/tmdb";
import { notFound } from "next/navigation";

interface Props {
  params: Promise<{ id: string }>;
}

export default async function FilmLanding({ params }: Props) {
  const { id } = await params;
  const film = await getFilmDetails(Number(id));

  if (!film) notFound();

  const filmYear = year(film.release_date);
  const filmDirector = director(film);
  const genres = film.genres?.map((g) => g.name).join(", ");

  return (
    <div className="flex flex-col min-h-screen bg-bg text-text">
      <div className="w-full max-w-[430px] mx-auto flex flex-col min-h-screen">
        {/* Header */}
        <header className="px-6 pt-6 pb-4 z-10">
          <Link
            href="/"
            className="text-xs font-mono tracking-[0.2em] uppercase text-muted hover:text-accent transition-colors"
          >
            ← Film Companion
          </Link>
        </header>

        {/* Poster */}
        <div className="relative w-full aspect-[2/3] max-h-[55vh]">
          <Image
            src={posterUrl(film.poster_path)}
            alt={`${film.title} poster`}
            fill
            className="object-cover"
            priority
            sizes="430px"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-bg via-bg/40 to-transparent" />
        </div>

        {/* Content */}
        <div className="relative -mt-32 z-10 px-6 flex flex-col gap-5 pb-10 flex-1">
          <div>
            <h1 className="text-3xl font-semibold tracking-tight leading-tight">
              {film.title}
            </h1>
            <p className="text-sm text-muted mt-1">
              {filmDirector} &middot; {filmYear}
              {film.runtime ? ` · ${film.runtime} min` : ""}
            </p>
            {genres && (
              <p className="text-xs text-muted/70 mt-1">{genres}</p>
            )}
          </div>

          <p className="text-base leading-relaxed text-text/90">
            {film.overview}
          </p>

          {/* Score */}
          {film.vote_average > 0 && (
            <div className="flex flex-wrap gap-2">
              <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-surface text-sm">
                <span className="text-accent font-medium">
                  {film.vote_average.toFixed(1)}
                </span>
                <span className="text-muted">TMDB</span>
              </span>
            </div>
          )}

          <div className="flex-1 min-h-6" />

          {/* CTA */}
          <Link
            href={`/film/${id}/sequence`}
            className="block w-full py-4 bg-accent text-bg text-center font-semibold text-base rounded-xl transition-all hover:brightness-110 active:scale-[0.98]"
          >
            Take a position
          </Link>

          <p className="text-xs text-muted text-center">
            4 cards &middot; 2 minutes &middot; no account needed
          </p>
        </div>
      </div>
    </div>
  );
}
