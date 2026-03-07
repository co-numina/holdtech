import { NextResponse } from "next/server";
import { cacheGet } from "@/app/lib/cache";

export const runtime = "edge";

// Trending refresh now runs locally via scripts/trending-refresh.mjs
// This endpoint just returns current cache status
export async function GET() {
  const cached = await cacheGet<any>("trending:results");
  if (cached) {
    return NextResponse.json({
      ...cached,
      status: "cached",
      ageSeconds: Math.round((Date.now() - cached.timestamp) / 1000),
    });
  }
  return NextResponse.json({
    tokens: [],
    timestamp: Date.now(),
    sources: [],
    status: "no_data",
    message: "Trending scanner is initializing — data will appear shortly.",
  });
}
