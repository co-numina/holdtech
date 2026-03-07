import { NextRequest, NextResponse } from "next/server";
import { cacheGet } from "@/app/lib/cache";

export const runtime = "edge";

// Thin cache reader — all heavy lifting done by /api/trending-refresh
export async function GET(req: NextRequest) {
  try {
    const source = req.nextUrl.searchParams.get("source") || "all";

    // Read from Redis cache
    const cached = await cacheGet<{
      tokens: any[];
      timestamp: number;
      sources: string[];
    }>("trending:results");

    if (cached && cached.tokens?.length > 0) {
      // Filter by source if needed
      let tokens = cached.tokens;
      if (source !== "all") {
        tokens = tokens.filter((t: any) => t.source === source);
      }

      const age = Date.now() - cached.timestamp;
      return NextResponse.json({
        tokens,
        timestamp: cached.timestamp,
        sources: source === "all" ? cached.sources : [source],
        cached: true,
        ageSeconds: Math.round(age / 1000),
      });
    }

    // No cache — local scanner hasn't run yet
    return NextResponse.json({
      tokens: [],
      timestamp: Date.now(),
      sources: [],
      cached: false,
      status: "refreshing",
      message: "Scanning trending tokens — results will appear in ~30 seconds. Refresh to check.",
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Trending scan failed" },
      { status: 500 }
    );
  }
}
