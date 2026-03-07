import { NextRequest, NextResponse } from "next/server";
import { cached } from "@/app/lib/cache";

export async function POST(req: NextRequest) {
  try {
    const { mints } = await req.json();
    if (!mints || !Array.isArray(mints) || mints.length === 0) {
      return NextResponse.json({ error: "No mints" }, { status: 400 });
    }

    const unique = [...new Set(mints as string[])].slice(0, 30);
    
    // Cache DexScreener prices per batch for 45s — price data stays relevant, avoids rate limits
    const cacheKey = `ds:${unique.sort().join(",").slice(0, 200)}`;
    const results = await cached(cacheKey, 45, async () => {
      const out: Record<string, {
        priceUsd: number | null;
        mc: number | null;
        change5m: number | null;
        change1h: number | null;
        change6h: number | null;
        change24h: number | null;
        volume24h: number | null;
        pairAddress: string | null;
      }> = {};

      const batches: string[][] = [];
      for (let i = 0; i < unique.length; i += 30) {
        batches.push(unique.slice(i, i + 30));
      }

      for (const batch of batches) {
        try {
          const url = `https://api.dexscreener.com/latest/dex/tokens/${batch.join(",")}`;
          const res = await fetch(url);
          if (!res.ok) continue;
          const data = await res.json();
          const pairs = data.pairs || [];

          const byMint: Record<string, any> = {};
          for (const pair of pairs) {
            const mint = pair.baseToken?.address;
            if (!mint) continue;
            if (!byMint[mint] || (pair.liquidity?.usd || 0) > (byMint[mint].liquidity?.usd || 0)) {
              byMint[mint] = pair;
            }
          }

          for (const [mint, pair] of Object.entries(byMint) as [string, any][]) {
            out[mint] = {
              priceUsd: pair.priceUsd ? parseFloat(pair.priceUsd) : null,
              mc: pair.marketCap || pair.fdv || null,
              change5m: pair.priceChange?.m5 ?? null,
              change1h: pair.priceChange?.h1 ?? null,
              change6h: pair.priceChange?.h6 ?? null,
              change24h: pair.priceChange?.h24 ?? null,
              volume24h: pair.volume?.h24 ?? null,
              pairAddress: pair.pairAddress || null,
            };
          }
        } catch {}
      }
      return out;
    });

    return NextResponse.json({ prices: results });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
