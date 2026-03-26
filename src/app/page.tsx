import Image from "next/image";
import Link from "next/link";

export default function Home() {
  return (
    <div className="flex flex-col min-h-screen bg-bg text-text">
      <div className="w-full max-w-[430px] mx-auto flex flex-col min-h-screen">
        {/* Header */}
        <header className="px-6 pt-6 pb-4">
          <p className="text-xs font-mono tracking-[0.2em] uppercase text-muted">
            Film Companion
          </p>
        </header>

        {/* Poster section */}
        <div className="relative w-full aspect-[2/3] max-h-[55vh]">
          <Image
            src="https://image.tmdb.org/t/p/w780/cgXk2tNYhJZLXdBDO5DidAVzQ82.jpg"
            alt="Anora movie poster"
            fill
            className="object-cover"
            priority
            sizes="430px"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-bg via-bg/40 to-transparent" />
        </div>

        {/* Content overlapping poster */}
        <div className="relative -mt-32 z-10 px-6 flex flex-col gap-5 pb-10 flex-1">
          <div>
            <h1 className="text-3xl font-semibold tracking-tight leading-tight">
              Anora
            </h1>
            <p className="text-sm text-muted mt-1">
              Sean Baker &middot; 2024 &middot; 139 min
            </p>
          </div>

          {/* Hook — the emotional work */}
          <p className="text-base leading-relaxed text-text/90">
            Palme d&apos;Or. Best Picture. And Letterboxd&apos;s most-liked
            negative review says Baker failed his own protagonist.
          </p>

          {/* Data point — the intellectual work */}
          <p className="text-sm text-muted leading-relaxed">
            Critics: 95% — Audiences: 79% — The gap is where it gets
            interesting.
          </p>

          <div className="flex-1 min-h-6" />

          {/* CTA */}
          <Link
            href="/sequence"
            className="block w-full py-4 bg-accent text-bg text-center font-semibold text-base rounded-xl transition-all hover:brightness-110 active:scale-[0.98]"
          >
            Take a position
          </Link>

          <p className="text-xs text-muted text-center">
            4 cards &middot; 2 minutes &middot; no account needed
          </p>

          {/* Below the fold */}
          <p className="text-xs text-muted/60 text-center mt-4">
            Film Companion v2 — a film journal that argues back.
          </p>
        </div>
      </div>
    </div>
  );
}
