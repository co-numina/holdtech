import { NextRequest, NextResponse } from "next/server";

const HELIUS_API_KEY = "2e5afdba-52c8-47bb-a203-d7571a17ade5";
const HELIUS_RPC = `https://mainnet.helius-rpc.com/?api-key=${HELIUS_API_KEY}`;

async function getHolderCount(mint: string): Promise<number | null> {
  try {
    // Use getTokenLargestAccounts as a proxy — but for real count, use getProgramAccounts count
    // Helius DAS getTokenAccounts with mint filter gives us the actual count
    const res = await fetch(HELIUS_RPC, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0", id: 1,
        method: "getTokenAccounts",
        params: { mint, limit: 1, page: 1 },
      }),
    });
    const data = await res.json();
    return data?.result?.total || null;
  } catch { return null; }
}

export async function POST(req: NextRequest) {
  try {
    const { mint } = await req.json();
    if (!mint) return NextResponse.json({ error: "Missing mint" }, { status: 400 });

    // Parallel: pump.fun + DexScreener + holder count
    const [pumpRes, dexRes, holderCountRes] = await Promise.allSettled([
      fetch(`https://frontend-api-v3.pump.fun/coins/${mint}`).then(r => r.ok ? r.json() : null),
      fetch(`https://api.dexscreener.com/latest/dex/tokens/${mint}`).then(r => r.ok ? r.json() : null),
      getHolderCount(mint),
    ]);

    const pump = pumpRes.status === "fulfilled" ? pumpRes.value : null;
    const dex = dexRes.status === "fulfilled" ? dexRes.value : null;
    const heliusHolders = holderCountRes.status === "fulfilled" ? holderCountRes.value : null;

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
      holderCount: pump?.holder_count || heliusHolders || null,
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
