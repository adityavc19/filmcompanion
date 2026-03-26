import { type Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { ANORA_CARDS } from "@/lib/cards";

interface Props {
  params: Promise<{ hash: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { hash } = await params;
  const ogUrl = `/api/og?d=${encodeURIComponent(hash)}`;

  return {
    title: "Someone took a position on Anora — Film Companion",
    description:
      "Palme d'Or. Best Picture. Critics: 95%. Audiences: 79%. Where do you land?",
    openGraph: {
      title: "Where do you land on Anora?",
      description:
        "Palme d'Or. Best Picture. And Letterboxd's most-liked negative review says Baker failed his own protagonist.",
      images: [{ url: ogUrl, width: 1200, height: 630 }],
    },
    twitter: {
      card: "summary_large_image",
      title: "Where do you land on Anora?",
      description:
        "4 provocations. 2 minutes. Take a position.",
      images: [ogUrl],
    },
  };
}

export default async function SharePage({ params }: Props) {
  const { hash } = await params;

  let positions: number[] = [];
  let texts: string[] = [];
  let rating = 0;

  try {
    const data = JSON.parse(atob(decodeURIComponent(hash)));
    positions = data.positions ?? [];
    texts = data.texts ?? [];
    rating = data.rating ?? 0;
  } catch {
    // Invalid hash — show anyway with empty state
  }

  const sliderCards = ANORA_CARDS.filter((c) => c.hasSlider);

  return (
    <div className="flex flex-col min-h-screen bg-bg text-text">
      <div className="w-full max-w-[430px] mx-auto flex flex-col min-h-screen px-6 py-6">
        {/* Header */}
        <p className="text-xs font-mono tracking-[0.2em] uppercase text-muted mb-2">
          Film Companion
        </p>
        <p className="text-sm text-muted mb-8">
          Someone took a position on Anora. Here&apos;s where they landed.
        </p>

        {/* Film card */}
        <div className="flex gap-4 mb-8">
          <div className="relative w-16 h-24 rounded-md overflow-hidden flex-shrink-0">
            <Image
              src="https://image.tmdb.org/t/p/w200/cgXk2tNYhJZLXdBDO5DidAVzQ82.jpg"
              alt="Anora"
              fill
              className="object-cover"
              sizes="64px"
            />
          </div>
          <div>
            <h1 className="text-xl font-semibold">Anora</h1>
            <p className="text-sm text-muted">Sean Baker &middot; 2024</p>
            {rating > 0 && (
              <p className="text-sm text-accent mt-1">
                {"★".repeat(Math.floor(rating))}
                {rating % 1 >= 0.5 ? "½" : ""}{" "}
                <span className="text-muted">{rating}/5</span>
              </p>
            )}
          </div>
        </div>

        {/* Their positions */}
        <div className="flex flex-col gap-6 mb-10">
          {sliderCards.map((card, idx) => {
            const position = positions[idx];
            const text = texts[idx];
            const hasPosition = position >= 0;

            return (
              <div key={card.id}>
                <span className="text-xs font-mono tracking-[0.1em] uppercase text-accent mb-2 block">
                  {card.type}
                </span>
                <p className="text-sm text-text/70 mb-3 leading-relaxed">
                  {card.provocation.length > 120
                    ? card.provocation.slice(0, 120) + "..."
                    : card.provocation}
                </p>

                {hasPosition && (
                  <div className="relative h-3 bg-surface rounded-full mb-2">
                    <div
                      className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-3 h-3 rounded-full bg-accent shadow-[0_0_8px_rgba(232,183,74,0.4)]"
                      style={{ left: `${position}%` }}
                    />
                  </div>
                )}
                <div className="flex justify-between">
                  <span className="text-[10px] text-muted">
                    {card.leftPole}
                  </span>
                  <span className="text-[10px] text-muted text-right">
                    {card.rightPole}
                  </span>
                </div>

                {text && (
                  <p className="text-sm text-text/60 mt-2 italic">
                    &ldquo;{text}&rdquo;
                  </p>
                )}
              </div>
            );
          })}
        </div>

        {/* Open prompt */}
        {texts[3] && (
          <div className="mb-10 p-4 rounded-lg bg-surface">
            <p className="text-xs font-mono tracking-[0.1em] uppercase text-accent mb-2">
              Their reflection
            </p>
            <p className="text-sm text-text/80 leading-relaxed">{texts[3]}</p>
          </div>
        )}

        <div className="flex-1" />

        {/* CTA */}
        <div className="pb-6">
          <Link
            href="/sequence"
            className="block w-full py-4 bg-accent text-bg text-center font-semibold text-base rounded-xl transition-all hover:brightness-110 active:scale-[0.98]"
          >
            Where do you land?
          </Link>
          <p className="text-xs text-muted text-center mt-3">
            4 cards &middot; 2 minutes &middot; no account needed
          </p>
        </div>
      </div>
    </div>
  );
}
