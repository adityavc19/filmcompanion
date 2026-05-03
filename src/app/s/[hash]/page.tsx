import { type Metadata } from "next";
import Link from "next/link";
import { decodeShareData } from "@/lib/share";

interface Props {
  params: Promise<{ hash: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { hash } = await params;
  const ogUrl = `/api/og?d=${encodeURIComponent(hash)}`;

  return {
    title: "Someone took a position — Film Companion",
    description: "4 provocations. 2 minutes. Where do you land?",
    openGraph: {
      title: "Where do you land?",
      description: "4 provocations. 2 minutes. Take a position.",
      images: [{ url: ogUrl, width: 1200, height: 630 }],
    },
    twitter: {
      card: "summary_large_image",
      title: "Where do you land?",
      images: [ogUrl],
    },
  };
}

export default async function SharePage({ params }: Props) {
  const { hash } = await params;

  let positions: number[] = [];
  let texts: string[] = [];
  let rating = 0;
  let filmTitle = "a film";

  const data = decodeShareData(hash);
  if (data) {
    positions = data.positions ?? [];
    texts = data.texts ?? [];
    rating = data.rating ?? 0;
    filmTitle = data.filmTitle ?? filmTitle;
  }

  return (
    <div className="flex flex-col min-h-screen bg-bg text-text">
      <div className="w-full max-w-[430px] mx-auto flex flex-col min-h-screen px-6 py-6">
        <p className="text-xs font-mono tracking-[0.2em] uppercase text-muted mb-2">
          Film Companion
        </p>
        <p className="text-sm text-muted mb-8">
          Someone took a position on <strong className="text-text">{filmTitle}</strong>.
        </p>

        {/* Rating */}
        {rating > 0 && (
          <p className="text-lg text-accent mb-6">
            {"★".repeat(Math.floor(rating))}
            {rating % 1 >= 0.5 ? "½" : ""}{" "}
            <span className="text-muted text-sm">{rating}/5</span>
          </p>
        )}

        {/* Positions */}
        <div className="flex flex-col gap-4 mb-8">
          {positions.slice(0, 3).map((pos, i) =>
            pos >= 0 ? (
              <div key={i}>
                <div className="relative h-3 bg-surface rounded-full mb-1">
                  <div
                    className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-3 h-3 rounded-full bg-accent shadow-[0_0_8px_rgba(232,183,74,0.4)]"
                    style={{ left: `${pos}%` }}
                  />
                </div>
                {texts[i] && (
                  <p className="text-sm text-text/60 italic mt-1">
                    &ldquo;{texts[i]}&rdquo;
                  </p>
                )}
              </div>
            ) : null
          )}
        </div>

        {texts[3] && (
          <div className="mb-8 p-4 rounded-lg bg-surface">
            <p className="text-sm text-text/80 leading-relaxed">{texts[3]}</p>
          </div>
        )}

        <div className="flex-1" />

        <Link
          href="/"
          className="block w-full py-4 bg-accent text-bg text-center font-semibold text-base rounded-xl transition-all hover:brightness-110 active:scale-[0.98]"
        >
          Where do you land?
        </Link>
        <p className="text-xs text-muted text-center mt-3">
          4 cards &middot; 2 minutes &middot; no account needed
        </p>
      </div>
    </div>
  );
}
