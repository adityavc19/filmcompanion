const TMDB_API_KEY = process.env.TMDB_API_KEY;
const BASE = "https://api.themoviedb.org/3";

export interface TMDBFilm {
  id: number;
  title: string;
  release_date: string;
  poster_path: string | null;
  backdrop_path: string | null;
  overview: string;
  vote_average: number;
  genre_ids?: number[];
  genres?: { id: number; name: string }[];
  runtime?: number;
  credits?: {
    crew: { name: string; job: string }[];
    cast: { name: string; character: string }[];
  };
}

async function tmdbFetch(path: string): Promise<Response> {
  return fetch(`${BASE}${path}${path.includes("?") ? "&" : "?"}api_key=${TMDB_API_KEY}`);
}

export async function searchFilms(query: string): Promise<TMDBFilm[]> {
  const res = await tmdbFetch(`/search/movie?query=${encodeURIComponent(query)}`);
  if (!res.ok) return [];
  const data = await res.json();
  return data.results?.slice(0, 8) ?? [];
}

export async function getFilmDetails(id: number): Promise<TMDBFilm | null> {
  const res = await tmdbFetch(`/movie/${id}?append_to_response=credits`);
  if (!res.ok) return null;
  return res.json();
}

export function posterUrl(path: string | null, size: string = "w780"): string {
  if (!path) return "/no-poster.svg";
  return `https://image.tmdb.org/t/p/${size}${path}`;
}

export function year(releaseDate: string): string {
  return releaseDate?.split("-")[0] ?? "";
}

export function director(film: TMDBFilm): string {
  return (
    film.credits?.crew.find((c) => c.job === "Director")?.name ?? "Unknown"
  );
}
