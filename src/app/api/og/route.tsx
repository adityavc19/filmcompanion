import { ImageResponse } from "@vercel/og";
import { type NextRequest } from "next/server";
import { decodeShareData } from "@/lib/share";

export const runtime = "edge";

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const d = searchParams.get("d");

  let positions = [50, 50, 50];
  let rating = 0;
  let filmTitle = "Film Companion";

  if (d) {
    const data = decodeShareData(d);
    if (data) {
      positions = data.positions?.slice(0, 3) ?? positions;
      rating = data.rating ?? 0;
      filmTitle = data.filmTitle ?? filmTitle;
    }
  }

  return new ImageResponse(
    (
      <div
        style={{
          width: "1200px",
          height: "630px",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          backgroundColor: "#0D0D0C",
          color: "#F0EDE6",
          fontFamily: "system-ui, sans-serif",
          padding: "60px 80px",
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
          Film Companion
        </div>

        <div
          style={{
            fontSize: "48px",
            fontWeight: 700,
            marginBottom: "24px",
          }}
        >
          {filmTitle}
        </div>

        {rating > 0 && (
          <div
            style={{
              display: "flex",
              fontSize: "24px",
              color: "#E8B74A",
              marginBottom: "32px",
            }}
          >
            {"★".repeat(Math.floor(rating))}
            {rating % 1 >= 0.5 ? "½" : ""}
          </div>
        )}

        {/* Position bars */}
        <div
          style={{
            display: "flex",
            gap: "16px",
            marginBottom: "40px",
          }}
        >
          {positions.slice(0, 3).map((pos, i) => (
            <div
              key={i}
              style={{
                display: "flex",
                position: "relative",
                height: "8px",
                backgroundColor: "#1A1A18",
                borderRadius: "4px",
                width: "200px",
              }}
            >
              {pos >= 0 && (
                <div
                  style={{
                    position: "absolute",
                    top: "-6px",
                    left: `${pos}%`,
                    width: "20px",
                    height: "20px",
                    borderRadius: "50%",
                    backgroundColor: "#E8B74A",
                    transform: "translateX(-50%)",
                  }}
                />
              )}
            </div>
          ))}
        </div>

        <div
          style={{
            fontSize: "28px",
            fontWeight: 600,
          }}
        >
          Where do you land?
        </div>
      </div>
    ),
    { width: 1200, height: 630 }
  );
}
