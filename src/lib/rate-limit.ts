import { NextRequest, NextResponse } from "next/server";
import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";

// Distributed rate limiter backed by Upstash Redis. Falls back to an
// in-memory window when Upstash env vars are missing (local dev / preview
// without KV configured).

const KV_URL = process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL;
const KV_TOKEN =
  process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN;

const redis =
  KV_URL && KV_TOKEN ? new Redis({ url: KV_URL, token: KV_TOKEN }) : null;

const limiters = new Map<string, Ratelimit>();

function getLimiter(key: string, limit: number, windowSec: number): Ratelimit | null {
  if (!redis) return null;
  const cacheKey = `${key}:${limit}:${windowSec}`;
  let lim = limiters.get(cacheKey);
  if (!lim) {
    lim = new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(limit, `${windowSec} s`),
      analytics: false,
      prefix: `fc:rl:${key}`,
    });
    limiters.set(cacheKey, lim);
  }
  return lim;
}

// Fallback in-memory bucket. Per-instance only — works as a soft cap when
// Upstash isn't configured. Replaced by the distributed limiter in prod.
const memBuckets = new Map<string, number[]>();
const MEM_MAX_BUCKETS = 5000;

function memCheck(
  ip: string,
  key: string,
  limit: number,
  windowMs: number
): { ok: boolean; retryAfterMs: number } {
  const k = `${key}:${ip}`;
  const now = Date.now();
  const cutoff = now - windowMs;

  if (memBuckets.size > MEM_MAX_BUCKETS) {
    const oldest = memBuckets.keys().next().value;
    if (oldest !== undefined) memBuckets.delete(oldest);
  }

  const hits = (memBuckets.get(k) ?? []).filter((t) => t > cutoff);
  if (hits.length >= limit) {
    return { ok: false, retryAfterMs: hits[0] + windowMs - now };
  }
  hits.push(now);
  memBuckets.set(k, hits);
  return { ok: true, retryAfterMs: 0 };
}

function clientIp(req: NextRequest): string {
  const fwd = req.headers.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0].trim();
  return req.headers.get("x-real-ip") ?? "unknown";
}

interface RateLimitOpts {
  limit: number;
  windowMs: number;
  key?: string;
}

export async function rateLimit(
  req: NextRequest,
  opts: RateLimitOpts
): Promise<NextResponse | null> {
  const ip = clientIp(req);
  const key = opts.key ?? "default";

  const lim = getLimiter(key, opts.limit, Math.ceil(opts.windowMs / 1000));
  if (lim) {
    const { success, reset } = await lim.limit(ip);
    if (success) return null;
    const retryAfter = Math.max(1, Math.ceil((reset - Date.now()) / 1000));
    return NextResponse.json(
      { error: "Too many requests" },
      {
        status: 429,
        headers: {
          "Retry-After": retryAfter.toString(),
          "X-RateLimit-Source": "upstash",
        },
      }
    );
  }

  const result = memCheck(ip, key, opts.limit, opts.windowMs);
  if (result.ok) return null;
  return NextResponse.json(
    { error: "Too many requests" },
    {
      status: 429,
      headers: {
        "Retry-After": Math.ceil(result.retryAfterMs / 1000).toString(),
        "X-RateLimit-Source": "memory",
      },
    }
  );
}
