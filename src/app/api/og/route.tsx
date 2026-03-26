import { ImageResponse } from "@vercel/og";
import { type NextRequest } from "next/server";
import { ANORA_CARDS } from "@/lib/cards";

export const runtime = "edge";

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const d = searchParams.get("d");

  let positions = [50, 50, 50];
  let rating = 0;

  if (d) {
    try {
      const data = JSON.parse(atob(decodeURIComponent(d)));
      positions = data.positions?.slice(0, 3) ?? positions;
      rating = data.rating ?? 0;
    } catch {
      // Use defaults
    }
  }

  // Pick Card 2 (the ending) as the featured provocation per spec
  const featuredCard = ANORA_CARDS[1];
  const featuredPosition = positions[1] >= 0 ? positions[1] : 50;

  return new ImageResponse(
    (
      <div
        style={{
          width: "1200px",
          height: "630px",
          display: "flex",
          backgroundColor: "#0D0D0C",
          color: "#F0EDE6",
          fontFamily: "system-ui, sans-serif",
          padding: "60px",
        }}
      >
        {/* Left: poster */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            justifyContent: "center",
            marginRight: "50px",
          }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="https://image.tmdb.org/t/p/w300/cgXk2tNYhJZLXdBDO5DidAVzQ82.jpg"
            alt="Anora"
            width={180}
            height={270}
            style={{ borderRadius: "8px" }}
          />
          {rating > 0 && (
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                marginTop: "12px",
                fontSize: "18px",
                color: "#E8B74A",
              }}
            >
              {"★".repeat(Math.floor(rating))}
              {rating % 1 >= 0.5 ? "½" : ""} {rating}/5
            </div>
          )}
        </div>

        {/* Right: provocation + position */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            justifyContent: "center",
            flex: 1,
          }}
        >
          <div
            style={{
              fontSize: "13px",
              letterSpacing: "0.15em",
              color: "#E8B74A",
              marginBottom: "16px",
              textTransform: "uppercase",
            }}
          >
            {featuredCard.type}
          </div>

          <div
            style={{
              fontSize: "22px",
              lineHeight: "1.5",
              color: "#F0EDE6",
              marginBottom: "40px",
              maxWidth: "700px",
            }}
          >
            {featuredCard.provocation.length > 180
              ? featuredCard.provocation.slice(0, 180) + "..."
              : featuredCard.provocation}
          </div>

          {/* Spectrum bar */}
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              width: "100%",
              maxWidth: "500px",
            }}
          >
            <div
              style={{
                display: "flex",
                position: "relative",
                height: "8px",
                backgroundColor: "#1A1A18",
                borderRadius: "4px",
                width: "100%",
              }}
            >
              <div
                style={{
                  position: "absolute",
                  top: "-6px",
                  left: `${featuredPosition}%`,
                  width: "20px",
                  height: "20px",
                  borderRadius: "50%",
                  backgroundColor: "#E8B74A",
                  transform: "translateX(-50%)",
                }}
              />
            </div>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                marginTop: "8px",
                fontSize: "13px",
                color: "#8A8780",
              }}
            >
              <span>{featuredCard.leftPole}</span>
              <span>{featuredCard.rightPole}</span>
            </div>
          </div>

          {/* CTA */}
          <div
            style={{
              fontSize: "28px",
              fontWeight: 600,
              color: "#F0EDE6",
              marginTop: "40px",
            }}
          >
            Where do you land?
          </div>

          {/* Branding */}
          <div
            style={{
              fontSize: "12px",
              color: "#8A8780",
              marginTop: "16px",
              letterSpacing: "0.1em",
            }}
          >
            FILM COMPANION
          </div>
        </div>
      </div>
    ),
    { width: 1200, height: 630 }
  );
}
