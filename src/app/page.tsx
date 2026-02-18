import Image from 'next/image';
import Link from 'next/link';
import SearchBar from '@/components/SearchBar';
import { getFilmDetail, getTmdbPosterUrl } from '@/lib/tmdb';

const POPULAR_IDS = [
  { id: 1317288, title: 'Marty Supreme' },
  { id: 496243,  title: 'Parasite' },
  { id: 933260,  title: 'The Substance' },
  { id: 660120,  title: 'The Worst Person in the World' },
  { id: 627,     title: 'Trainspotting' },
];

async function getPopularFilms() {
  const results = await Promise.allSettled(
    POPULAR_IDS.map(({ id }) => getFilmDetail(id))
  );

  return POPULAR_IDS.map((film, i) => {
    const result = results[i];
    const tmdb = result.status === 'fulfilled' ? result.value : null;
    return {
      id: film.id,
      title: film.title,
      poster_path: tmdb?.poster_path ?? null,
    };
  });
}

export default async function HomePage() {
  const popularFilms = await getPopularFilms();

  return (
    <main className="min-h-screen flex flex-col">
      {/* Hero */}
      <div className="flex-1 flex flex-col items-center justify-center px-4 py-20">
        <div className="text-center mb-12">
          <h1 className="font-display text-5xl md:text-6xl text-white mb-4 tracking-tight">
            Film Companion
          </h1>
          <p className="text-cinema-muted text-lg md:text-xl max-w-lg mx-auto leading-relaxed">
            Discuss any film like you just watched it together.
          </p>
          <p className="text-cinema-muted/60 text-sm mt-2">
            Draws from Letterboxd, Reddit, critics, and video essays.
          </p>
        </div>

        <div className="w-full">
          <SearchBar autoFocus />
        </div>
      </div>

      {/* Popular films */}
      <div className="border-t border-cinema-border/40 bg-cinema-surface/30 backdrop-blur px-4 py-8">
        <div className="max-w-4xl mx-auto">
          <p className="text-cinema-muted/60 text-xs uppercase tracking-widest mb-5 text-center">
            Start with a popular film
          </p>
          <div className="flex justify-center gap-4 flex-wrap">
            {popularFilms.map((film) => (
              <Link
                key={film.id}
                href={`/film/${film.id}`}
                className="group flex flex-col items-center gap-2 w-20"
              >
                <div className="w-20 rounded-lg overflow-hidden ring-1 ring-white/10 group-hover:ring-cinema-accent/50 transition-all bg-cinema-surface">
                  {film.poster_path ? (
                    <Image
                      src={getTmdbPosterUrl(film.poster_path, 'w185')}
                      alt={film.title}
                      width={80}
                      height={120}
                      className="object-cover w-full h-auto group-hover:scale-105 transition-transform"
                    />
                  ) : (
                    <div className="w-20 h-[120px] bg-cinema-border flex items-center justify-center">
                      <span className="text-cinema-muted text-xs text-center px-1">{film.title}</span>
                    </div>
                  )}
                </div>
                <span className="text-cinema-muted text-xs text-center leading-tight group-hover:text-white transition-colors">
                  {film.title}
                </span>
              </Link>
            ))}
          </div>
        </div>
      </div>
    </main>
  );
}
