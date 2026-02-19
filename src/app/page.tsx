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
    return { id: film.id, title: film.title, poster_path: tmdb?.poster_path ?? null };
  });
}

export default async function HomePage() {
  const popularFilms = await getPopularFilms();

  return (
    <main style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', position: 'relative', background: '#0C0C0B' }}>
      {/* Cover image */}
      <div style={{ position: 'fixed', inset: 0, zIndex: 0 }}>
        <Image src="/cover.jpeg" alt="" fill style={{ objectFit: 'cover' }} priority />
        <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to bottom, rgba(12,12,11,0.55) 0%, rgba(12,12,11,0.45) 50%, rgba(12,12,11,0.7) 100%)' }} />
      </div>

      {/* Nav */}
      <nav style={{ position: 'relative', zIndex: 10, padding: '18px 28px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ width: 7, height: 7, borderRadius: '50%', background: '#E8B74A' }} />
          <span style={{ fontSize: 13, fontWeight: 500, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.5)' }}>
            Film Companion
          </span>
        </div>
      </nav>

      {/* Hero — vertically centered */}
      <div style={{ position: 'relative', zIndex: 10, flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '0 24px 60px' }}>
        {/* Title */}
        <div style={{ textAlign: 'center', marginBottom: 40 }}>
          <h1 style={{
            fontSize: 'clamp(44px, 8vw, 72px)',
            fontFamily: 'var(--font-instrument), Georgia, serif',
            fontWeight: 400,
            lineHeight: 1.05,
            color: '#F0EDE6',
            margin: 0,
            letterSpacing: '-0.01em',
            textShadow: '0 2px 24px rgba(0,0,0,0.4)',
          }}>
            Film Companion
          </h1>
          <p style={{ fontSize: 16, color: 'rgba(255,255,255,0.55)', marginTop: 14, fontFamily: 'var(--font-dm-sans), sans-serif', letterSpacing: '0.01em' }}>
            Discuss any film like you just watched it together.
          </p>
          <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.3)', marginTop: 6, fontFamily: 'var(--font-dm-sans), sans-serif', letterSpacing: '0.06em', textTransform: 'uppercase' }}>
            Draws from Letterboxd · Reddit · Critics · Video essays
          </p>
        </div>

        {/* Search */}
        <div style={{ width: '100%', maxWidth: 560 }}>
          <SearchBar autoFocus />
        </div>
      </div>

      {/* Popular films — bottom */}
      <div style={{ position: 'relative', zIndex: 10, paddingBottom: 32, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16 }}>
        <p style={{ fontSize: 10, fontWeight: 600, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.25)', fontFamily: 'var(--font-dm-sans), sans-serif' }}>
          Start with a popular film
        </p>
        <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', justifyContent: 'center', padding: '0 24px' }}>
          {popularFilms.map((film) => (
            <Link
              key={film.id}
              href={`/film/${film.id}`}
              style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, width: 76, textDecoration: 'none' }}
            >
              <div style={{ width: 76, borderRadius: 6, overflow: 'hidden', boxShadow: '0 4px 20px rgba(0,0,0,0.5)', transition: 'transform 0.2s, box-shadow 0.2s' }}>
                {film.poster_path ? (
                  <Image
                    src={getTmdbPosterUrl(film.poster_path, 'w185')}
                    alt={film.title}
                    width={76}
                    height={114}
                    style={{ display: 'block', objectFit: 'cover', width: '100%', height: 'auto' }}
                  />
                ) : (
                  <div style={{ width: 76, height: 114, background: '#1A1816', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <span style={{ fontSize: 10, color: '#444', textAlign: 'center', padding: '0 4px' }}>{film.title}</span>
                  </div>
                )}
              </div>
              <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)', textAlign: 'center', lineHeight: 1.3, fontFamily: 'var(--font-dm-sans), sans-serif' }}>
                {film.title}
              </span>
            </Link>
          ))}
        </div>
      </div>
    </main>
  );
}
