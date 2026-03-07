import { NextRequest, NextResponse } from "next/server";

export const runtime = "edge";

const HELIUS_API_KEY = process.env.HELIUS_API_KEY || "2e5afdba-52c8-47bb-a203-d7571a17ade5";
const HELIUS_RPC = `https://mainnet.helius-rpc.com/?api-key=${HELIUS_API_KEY}`;

interface TrendingToken {
  mint: string;
  name: string;
  symbol: string;
  image: string | null;
  marketCap: number;
  source: "pump_hot" | "pump_live" | "pump_graduated" | "pump_active" | "pump_volume" | "dex_boosted";
  boostAmount?: number;
  sniperCount?: number;
  volume?: number;
  topHoldersPct?: number;
  devHoldingsPct?: number;
  numHolders?: number;
  buyTxns?: number;
  sellTxns?: number;
  athMarketCap?: number | null;
  sniperOwnedPct?: number;
}

interface ScoredToken extends TrendingToken {
  holderCount: number;
  freshPct: number;
  avgWalletAgeDays: number;
  grade: string;
  score: number;
}

async function getPumpHot(): Promise<TrendingToken[]> {
  try {
    const res = await fetch("https://frontend-api-v3.pump.fun/coins?limit=10&sort=market_cap&order=DESC&includeNsfw=false", {
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) return [];
    const data = await res.json();
    return (data || []).slice(0, 10).map((c: any) => ({
      mint: c.mint,
      name: c.name || "Unknown",
      symbol: c.symbol || "???",
      image: c.image_uri || null,
      marketCap: Math.round(c.usd_market_cap || 0),
      source: "pump_hot" as const,
    }));
  } catch { return []; }
}

async function getPumpLive(): Promise<TrendingToken[]> {
  try {
    const res = await fetch("https://frontend-api-v3.pump.fun/coins/currently-live?limit=10&includeNsfw=false", {
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) return [];
    const data = await res.json();
    return (data || []).slice(0, 10).map((c: any) => ({
      mint: c.mint,
      name: c.name || "Unknown",
      symbol: c.symbol || "???",
      image: c.image_uri || null,
      marketCap: Math.round(c.usd_market_cap || 0),
      source: "pump_live" as const,
    }));
  } catch { return []; }
}

async function getPumpGraduated(): Promise<TrendingToken[]> {
  // Use advanced API v2 — returns holder data, sniper counts, volume inline
  try {
    const res = await fetch("https://advanced-api-v2.pump.fun/coins/graduated?limit=15", {
      headers: { "Accept": "application/json", "Origin": "https://pump.fun" },
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) {
      // Fallback to frontend API
      return getPumpGraduatedFallback();
    }
    const data = await res.json();
    const coins = data.coins || data || [];
    if (!Array.isArray(coins)) return getPumpGraduatedFallback();

    return coins.slice(0, 15).map((c: any) => ({
      mint: c.coinMint || c.mint,
      name: c.name || "Unknown",
      symbol: c.ticker || c.symbol || "???",
      image: c.imageUrl || c.image_uri || null,
      marketCap: Math.round((c.marketCap || 0) * (c.currentMarketPrice || 1)),
      source: "pump_graduated" as const,
      // Extra fields from advanced API
      sniperCount: c.sniperCount || 0,
      volume: c.volume || 0,
      topHoldersPct: Math.round((c.topHoldersPercentage || 0) * 100),
      devHoldingsPct: Math.round((c.devHoldingsPercentage || 0) * 100),
      numHolders: c.numHolders || 0,
      buyTxns: c.buyTransactions || 0,
      sellTxns: c.sellTransactions || 0,
      athMarketCap: c.allTimeHighMarketCap || null,
      sniperOwnedPct: Math.round((c.sniperOwnedPercentage || 0) * 100),
    }));
  } catch {
    return getPumpGraduatedFallback();
  }
}

async function getPumpGraduatedFallback(): Promise<TrendingToken[]> {
  try {
    const res = await fetch("https://frontend-api-v3.pump.fun/coins?limit=10&sort=created_timestamp&order=DESC&includeNsfw=false&complete=true", {
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) return [];
    const data = await res.json();
    return (data || []).slice(0, 10).map((c: any) => ({
      mint: c.mint,
      name: c.name || "Unknown",
      symbol: c.symbol || "???",
      image: c.image_uri || null,
      marketCap: Math.round(c.usd_market_cap || 0),
      source: "pump_graduated" as const,
    }));
  } catch { return []; }
}

async function getPumpMostTraded(): Promise<TrendingToken[]> {
  try {
    const res = await fetch("https://frontend-api-v3.pump.fun/coins?limit=10&sort=last_trade_timestamp&order=DESC&includeNsfw=false&complete=true", {
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) return [];
    const data = await res.json();
    return (data || []).slice(0, 10).map((c: any) => ({
      mint: c.mint,
      name: c.name || "Unknown",
      symbol: c.symbol || "???",
      image: c.image_uri || null,
      marketCap: Math.round(c.usd_market_cap || 0),
      source: "pump_active" as const,
    }));
  } catch { return []; }
}

async function getPumpHighVolume(): Promise<TrendingToken[]> {
  try {
    // Graduated tokens by highest mcap = highest volume proxy
    const res = await fetch("https://frontend-api-v3.pump.fun/coins?limit=10&sort=market_cap&order=DESC&includeNsfw=false&complete=true", {
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) return [];
    const data = await res.json();
    return (data || []).slice(0, 10).map((c: any) => ({
      mint: c.mint,
      name: c.name || "Unknown",
      symbol: c.symbol || "???",
      image: c.image_uri || null,
      marketCap: Math.round(c.usd_market_cap || 0),
      source: "pump_volume" as const,
    }));
  } catch { return []; }
}

async function getDexBoosted(): Promise<TrendingToken[]> {
  try {
    const res = await fetch("https://api.dexscreener.com/token-boosts/top/v1", {
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) return [];
    const data = await res.json();
    const solana = (data || []).filter((t: any) => t.chainId === "solana").slice(0, 10);

    // Fetch metadata for boosted tokens from pump.fun
    const tokens: TrendingToken[] = [];
    for (let i = 0; i < solana.length; i += 5) {
      const batch = solana.slice(i, i + 5);
      const results = await Promise.allSettled(
        batch.map(async (t: any) => {
          const mint = t.tokenAddress;
          let name = "Unknown", symbol = "???", image: string | null = null, marketCap = 0;
          try {
            const pRes = await fetch(`https://frontend-api-v3.pump.fun/coins/${mint}`, { signal: AbortSignal.timeout(3000) });
            if (pRes.ok) {
              const text = await pRes.text();
              if (text) {
                const coin = JSON.parse(text);
                name = coin.name || name;
                symbol = coin.symbol || symbol;
                image = coin.image_uri || null;
                marketCap = Math.round(coin.usd_market_cap || 0);
              }
            }
          } catch {}
          return { mint, name, symbol, image, marketCap, source: "dex_boosted" as const, boostAmount: t.totalAmount || 0 };
        })
      );
      for (const r of results) {
        if (r.status === "fulfilled") tokens.push(r.value);
      }
    }
    return tokens;
  } catch { return []; }
}

async function quickScore(mint: string): Promise<{ holderCount: number; freshPct: number; avgWalletAgeDays: number; grade: string; score: number; sniperCount?: number; topHoldersPct?: number; devHoldingsPct?: number }> {
  // Try pump.fun frontend API first — has holder count, market cap, completion status
  try {
    const pumpRes = await fetch(`https://frontend-api-v3.pump.fun/coins/${mint}`, {
      signal: AbortSignal.timeout(4000),
    });
    if (pumpRes.ok) {
      const text = await pumpRes.text();
      if (text) {
        const coin = JSON.parse(text);
        // Use pump.fun data for a quick grade
        const graduated = coin.complete === true;
        const mcap = coin.usd_market_cap || 0;

        // Get holder count from DAS (fast, one call)
        let holderCount = 0;
        try {
          const hRes = await fetch(HELIUS_RPC, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "getTokenAccounts", params: { mint, limit: 1000 } }),
            signal: AbortSignal.timeout(5000),
          });
          const hData = await hRes.json();
          holderCount = hData.result?.token_accounts?.length || 0;
        } catch {}

        // Grade based on holder count + graduation + engagement
        let grade = "C";
        let score = 50;

        // Holder count signals
        if (holderCount > 500) { score += 20; }
        else if (holderCount > 200) { score += 10; }
        else if (holderCount > 50) { score += 0; }
        else if (holderCount > 20) { score -= 10; }
        else { score -= 25; }

        // Graduated = passed bonding curve = stronger signal
        if (graduated) { score += 15; }

        // Clamp and assign grade
        score = Math.max(10, Math.min(95, score));
        if (score >= 80) grade = "A";
        else if (score >= 65) grade = "B";
        else if (score >= 45) grade = "C";
        else if (score >= 30) grade = "D";
        else grade = "F";

        return { holderCount, freshPct: 0, avgWalletAgeDays: 0, grade, score };
      }
    }
  } catch {}

  // Fallback: just get holder count from DAS
  try {
    const res = await fetch(HELIUS_RPC, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "getTokenAccounts", params: { mint, limit: 1000 } }),
      signal: AbortSignal.timeout(5000),
    });
    const data = await res.json();
    const holderCount = data.result?.token_accounts?.length || 0;

    let grade = "C", score = 50;
    if (holderCount > 500) { score = 70; grade = "B"; }
    else if (holderCount > 100) { score = 55; grade = "C"; }
    else if (holderCount < 20) { score = 25; grade = "D"; }

    return { holderCount, freshPct: 0, avgWalletAgeDays: 0, grade, score };
  } catch {
    return { holderCount: 0, freshPct: 0, avgWalletAgeDays: 0, grade: "?", score: 0 };
  }
}

export async function GET(req: NextRequest) {
  try {
    const source = req.nextUrl.searchParams.get("source") || "all";

    // Fetch trending tokens from selected sources
    let tokens: TrendingToken[] = [];

    if (source === "all" || source === "pump_hot") {
      tokens.push(...await getPumpHot());
    }
    if (source === "all" || source === "pump_live") {
      tokens.push(...await getPumpLive());
    }
    if (source === "all" || source === "pump_graduated") {
      tokens.push(...await getPumpGraduated());
    }
    if (source === "all" || source === "pump_active") {
      tokens.push(...await getPumpMostTraded());
    }
    if (source === "all" || source === "dex_boosted") {
      tokens.push(...await getDexBoosted());
    }

    // Deduplicate by mint
    const seen = new Set<string>();
    tokens = tokens.filter(t => {
      if (seen.has(t.mint)) return false;
      seen.add(t.mint);
      return true;
    });

    // Score top 15 (to stay within edge timeout)
    const toScore = tokens.slice(0, 15);
    const scored: ScoredToken[] = [];

    // Score in batches of 5
    for (let i = 0; i < toScore.length; i += 5) {
      const batch = toScore.slice(i, i + 5);
      const results = await Promise.allSettled(
        batch.map(async (token) => {
          // If advanced API already gave us holder data, use it for a fast grade
          if (token.numHolders && token.topHoldersPct !== undefined) {
            const topPct = token.topHoldersPct;
            const sniperPct = token.sniperOwnedPct || 0;
            let grade = "A", score = 85;
            if (topPct > 80 || sniperPct > 30) { grade = "F"; score = 15; }
            else if (topPct > 60 || sniperPct > 20) { grade = "D"; score = 35; }
            else if (topPct > 40) { grade = "C"; score = 55; }
            else if (topPct > 25) { grade = "B"; score = 72; }
            if (token.numHolders < 15) { score = Math.max(score - 20, 10); grade = score < 30 ? "F" : score < 50 ? "D" : grade; }
            if (token.devHoldingsPct && token.devHoldingsPct > 10) { score = Math.max(score - 15, 10); }
            return { ...token, holderCount: token.numHolders, freshPct: 0, avgWalletAgeDays: 0, grade, score };
          }
          // Otherwise do the full RPC-based quickScore
          const scoreData = await quickScore(token.mint);
          return { ...token, ...scoreData };
        })
      );
      for (const r of results) {
        if (r.status === "fulfilled") scored.push(r.value);
      }
    }

    // Sort by score descending
    scored.sort((a, b) => b.score - a.score);

    return NextResponse.json({
      tokens: scored,
      timestamp: Date.now(),
      sources: source === "all" ? ["pump_hot", "pump_live", "dex_boosted"] : [source],
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Trending scan failed" },
      { status: 500 }
    );
  }
}
