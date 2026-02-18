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
    <main className="min-h-screen flex flex-col relative">
      {/* Cover image background */}
      <div className="fixed inset-0 z-0">
        <Image
          src="/cover.jpeg"
          alt=""
          fill
          className="object-cover"
          priority
        />
        {/* Dark overlay */}
        <div className="absolute inset-0 bg-gradient-to-b from-black/50 via-black/40 to-black/60" />
      </div>

      {/* Hero */}
      <div className="relative z-10 flex-1 flex flex-col items-center justify-center px-4 py-20">
        <div className="text-center mb-12">
          <h1 className="font-display text-5xl md:text-6xl text-white mb-4 tracking-tight drop-shadow-lg">
            Film Companion
          </h1>
          <p className="text-white/70 text-lg md:text-xl max-w-lg mx-auto leading-relaxed">
            Discuss any film like you just watched it together.
          </p>
          <p className="text-white/80 text-sm mt-2">
            Draws from Letterboxd, Reddit, critics, and video essays.
          </p>
        </div>

        <div className="w-full">
          <SearchBar autoFocus />
        </div>
      </div>

      {/* Popular films */}
      <div className="relative z-10 flex justify-center pb-10">
        <div className="inline-flex flex-col items-center gap-4 bg-black/20 backdrop-blur-sm border border-white/10 rounded-2xl px-6 py-5">
          <p className="text-white/40 text-xs uppercase tracking-widest">
            Start with a popular film
          </p>
          <div className="flex gap-4 flex-wrap justify-center">
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
                <span className="text-white/50 text-xs text-center leading-tight group-hover:text-white transition-colors">
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
