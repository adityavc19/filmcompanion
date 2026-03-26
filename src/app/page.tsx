import Image from "next/image";
import Link from "next/link";

export default function Home() {
  return (
    <div className="flex flex-col min-h-screen bg-bg text-text">
      {/* Mobile-first container: 430px design width, centered on larger screens */}
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
          {/* Gradient overlay at bottom */}
          <div className="absolute inset-0 bg-gradient-to-t from-bg via-bg/40 to-transparent" />
        </div>

        {/* Content section overlapping poster */}
        <div className="relative -mt-32 z-10 px-6 flex flex-col gap-5 pb-10 flex-1">
          {/* Film title */}
          <div>
            <h1 className="text-3xl font-semibold tracking-tight leading-tight">
              Anora
            </h1>
            <p className="text-sm text-muted mt-1">
              Sean Baker &middot; 2024 &middot; 139 min
            </p>
          </div>

          {/* Hook text */}
          <p className="text-base leading-relaxed text-text/90">
            A sex worker from Brooklyn marries the son of a Russian oligarch —
            and then everything unravels. Palme d&apos;Or winner. Critics loved it.
            Audiences are split. Where do you land?
          </p>

          {/* Score tags */}
          <div className="flex flex-wrap gap-2">
            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-surface text-sm">
              <span className="text-accent font-medium">97%</span>
              <span className="text-muted">Critics</span>
            </span>
            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-surface text-sm">
              <span className="text-accent font-medium">81%</span>
              <span className="text-muted">Audience</span>
            </span>
            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-surface text-sm">
              <span className="text-accent font-medium">4.1</span>
              <span className="text-muted">Letterboxd</span>
            </span>
          </div>

          {/* Spacer to push CTA down */}
          <div className="flex-1 min-h-6" />

          {/* CTA */}
          <Link
            href="/sequence"
            className="block w-full py-4 bg-accent text-bg text-center font-semibold text-base rounded-xl transition-all hover:brightness-110 active:scale-[0.98]"
          >
            Take a position
          </Link>

          {/* Subtle context line */}
          <p className="text-xs text-muted text-center">
            3 questions &middot; 2 minutes &middot; no account needed
          </p>
        </div>
      </div>
    </div>
  );
}
