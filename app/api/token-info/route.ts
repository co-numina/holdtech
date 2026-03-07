import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  try {
    const { mint } = await req.json();
    if (!mint) return NextResponse.json({ error: "Missing mint" }, { status: 400 });

    // Parallel: pump.fun + DexScreener (holder count handled by /api/holder-count)
    const [pumpRes, dexRes] = await Promise.allSettled([
      fetch(`https://frontend-api-v3.pump.fun/coins/${mint}`).then(r => r.ok ? r.json() : null),
      fetch(`https://api.dexscreener.com/latest/dex/tokens/${mint}`).then(r => r.ok ? r.json() : null),
    ]);

    const pump = pumpRes.status === "fulfilled" ? pumpRes.value : null;
    const dex = dexRes.status === "fulfilled" ? dexRes.value : null;

    const solPair = dex?.pairs?.find((p: Record<string, unknown>) => p.chainId === "solana");

    // Token metadata
    const info = {
      name: pump?.name || solPair?.baseToken?.name || "Unknown",
      symbol: pump?.symbol || solPair?.baseToken?.symbol || "???",
      image: pump?.image_uri || solPair?.info?.imageUrl || null,
      description: pump?.description || null,
      website: pump?.website || solPair?.info?.websites?.[0]?.url || null,
      twitter: pump?.twitter || solPair?.info?.socials?.find((s: Record<string, string>) => s.type === "twitter")?.url || null,
      // Market data
      price: solPair?.priceUsd ? parseFloat(solPair.priceUsd) : null,
      priceNative: solPair?.priceNative ? parseFloat(solPair.priceNative) : null,
      mcap: solPair?.marketCap || solPair?.fdv || null,
      volume24h: solPair?.volume?.h24 || null,
      liquidity: solPair?.liquidity?.usd || null,
      priceChange: {
        m5: solPair?.priceChange?.m5 || null,
        h1: solPair?.priceChange?.h1 || null,
        h6: solPair?.priceChange?.h6 || null,
        h24: solPair?.priceChange?.h24 || null,
      },
      // Holder count from pump
      holderCount: pump?.holder_count || null,
      pairAddress: solPair?.pairAddress || null,
      dexId: solPair?.dexId || null,
      // Sparkline data (will be populated below)
      sparkline: [] as number[],
    };

    // Fetch OHLCV from GeckoTerminal for sparkline (free, no key)
    if (solPair?.pairAddress) {
      try {
        const gtRes = await fetch(
          `https://api.geckoterminal.com/api/v2/networks/solana/pools/${solPair.pairAddress}/ohlcv/minute?aggregate=15&limit=96&currency=usd`,
          { headers: { Accept: "application/json" } }
        );
        if (gtRes.ok) {
          const gtData = await gtRes.json();
          const candles = gtData?.data?.attributes?.ohlcv_list || [];
          // ohlcv_list: [[timestamp, open, high, low, close, volume], ...]
          // Sort by timestamp ascending, take close prices
          info.sparkline = candles
            .sort((a: number[], b: number[]) => a[0] - b[0])
            .map((c: number[]) => c[4]); // close price
        }
      } catch { /* skip sparkline */ }
    }

    return NextResponse.json(info);
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Failed" }, { status: 500 });
  }
}
