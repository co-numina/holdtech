import { NextRequest, NextResponse } from "next/server";
import { cacheSet, cacheGet } from "@/app/lib/cache";

// Node.js runtime — no 25s edge timeout, gets full 60s
export const runtime = "nodejs";
export const maxDuration = 60;

const HELIUS_API_KEY = process.env.HELIUS_API_KEY || "2e5afdba-52c8-47bb-a203-d7571a17ade5";
const HELIUS_RPC = `https://mainnet.helius-rpc.com/?api-key=${HELIUS_API_KEY}`;

interface TrendingToken {
  mint: string;
  name: string;
  symbol: string;
  image: string | null;
  marketCap: number;
  source: string;
  boostAmount?: number;
}

interface ScanMetrics {
  avgWalletAgeDays: number;
  medianWalletAgeDays: number;
  avgHoldDurationDays: number;
  medianHoldDurationDays: number;
  freshWalletPct: number;
  veryFreshWalletPct: number;
  diamondHandsPct: number;
  veteranHolderPct: number;
  ogHolderPct: number;
  avgTxCount: number;
  lowActivityPct: number;
  avgSolBalance: number;
  singleTokenPct: number;
}

interface ScoredToken extends TrendingToken {
  holderCount: number;
  freshPct: number;
  avgWalletAgeDays: number;
  grade: string;
  score: number;
  verdict?: string;
  flags?: string[];
  metrics?: ScanMetrics;
  topHolders?: any[];
  distribution?: any;
}

// ─── Source fetchers ───

async function getPumpHot(): Promise<TrendingToken[]> {
  try {
    const res = await fetch("https://frontend-api-v3.pump.fun/coins?limit=10&sort=market_cap&order=DESC&includeNsfw=false", { signal: AbortSignal.timeout(5000) });
    if (!res.ok) return [];
    const data = await res.json();
    return (data || []).slice(0, 10).map((c: any) => ({
      mint: c.mint, name: c.name || "Unknown", symbol: c.symbol || "???",
      image: c.image_uri || null, marketCap: Math.round(c.usd_market_cap || 0), source: "pump_hot",
    }));
  } catch { return []; }
}

async function getPumpLive(): Promise<TrendingToken[]> {
  try {
    const res = await fetch("https://frontend-api-v3.pump.fun/coins/currently-live?limit=10&includeNsfw=false", { signal: AbortSignal.timeout(5000) });
    if (!res.ok) return [];
    const data = await res.json();
    return (data || []).slice(0, 10).map((c: any) => ({
      mint: c.mint, name: c.name || "Unknown", symbol: c.symbol || "???",
      image: c.image_uri || null, marketCap: Math.round(c.usd_market_cap || 0), source: "pump_live",
    }));
  } catch { return []; }
}

async function getPumpGraduated(): Promise<TrendingToken[]> {
  try {
    const res = await fetch("https://frontend-api-v3.pump.fun/coins?limit=15&sort=created_timestamp&order=DESC&includeNsfw=false&complete=true", { signal: AbortSignal.timeout(5000) });
    if (!res.ok) return [];
    const data = await res.json();
    return (data || []).slice(0, 15).map((c: any) => ({
      mint: c.mint, name: c.name || "Unknown", symbol: c.symbol || "???",
      image: c.image_uri || null, marketCap: Math.round(c.usd_market_cap || 0), source: "pump_graduated",
    }));
  } catch { return []; }
}

async function getPumpMostTraded(): Promise<TrendingToken[]> {
  try {
    const res = await fetch("https://frontend-api-v3.pump.fun/coins?limit=10&sort=last_trade_timestamp&order=DESC&includeNsfw=false&complete=true", { signal: AbortSignal.timeout(5000) });
    if (!res.ok) return [];
    const data = await res.json();
    return (data || []).slice(0, 10).map((c: any) => ({
      mint: c.mint, name: c.name || "Unknown", symbol: c.symbol || "???",
      image: c.image_uri || null, marketCap: Math.round(c.usd_market_cap || 0), source: "pump_active",
    }));
  } catch { return []; }
}

async function getDexBoosted(): Promise<TrendingToken[]> {
  try {
    const res = await fetch("https://api.dexscreener.com/token-boosts/top/v1", { signal: AbortSignal.timeout(5000) });
    if (!res.ok) return [];
    const data = await res.json();
    const solana = (data || []).filter((t: any) => t.chainId === "solana").slice(0, 10);
    const tokens: TrendingToken[] = [];
    for (const t of solana) {
      const mint = t.tokenAddress;
      let name = "Unknown", symbol = "???", image: string | null = null, marketCap = 0;
      try {
        const pRes = await fetch(`https://frontend-api-v3.pump.fun/coins/${mint}`, { signal: AbortSignal.timeout(3000) });
        if (pRes.ok) {
          const text = await pRes.text();
          if (text) { const coin = JSON.parse(text); name = coin.name || name; symbol = coin.symbol || symbol; image = coin.image_uri || null; marketCap = Math.round(coin.usd_market_cap || 0); }
        }
      } catch {}
      tokens.push({ mint, name, symbol, image, marketCap, source: "dex_boosted", boostAmount: t.totalAmount || 0 });
    }
    return tokens;
  } catch { return []; }
}

// ─── Full scan per token ───

async function fullScanToken(mint: string, baseUrl: string): Promise<{ holderCount: number; freshPct: number; avgWalletAgeDays: number; grade: string; score: number; verdict?: string; flags?: string[]; metrics?: ScanMetrics; topHolders?: any[]; distribution?: any } | null> {
  try {
    // Step 1: Run the real analyze endpoint (top 20 holders)
    const analyzeRes = await fetch(`${baseUrl}/api/analyze`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ mint, limit: 20 }),
      signal: AbortSignal.timeout(15000),
    });
    if (!analyzeRes.ok) return null;
    const analyzeData = await analyzeRes.json();
    if (!analyzeData.metrics) return null;

    // Step 2: Run ai-verdict on the results
    const verdictRes = await fetch(`${baseUrl}/api/ai-verdict`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        metrics: analyzeData.metrics,
        totalHolders: analyzeData.totalHolders,
        analyzedHolders: analyzeData.analyzedHolders,
        tokenSymbol: analyzeData.tokenSymbol,
        tokenAgeHours: null,
        mint,
      }),
      signal: AbortSignal.timeout(5000),
    });
    if (!verdictRes.ok) return null;
    const verdictData = await verdictRes.json();

    return {
      holderCount: analyzeData.totalHolders || analyzeData.analyzedHolders || 0,
      freshPct: analyzeData.metrics.freshWalletPct || 0,
      avgWalletAgeDays: analyzeData.metrics.avgWalletAgeDays || 0,
      grade: verdictData.grade || "?",
      score: verdictData.score || 0,
      verdict: verdictData.verdict,
      flags: verdictData.flags,
      metrics: analyzeData.metrics,
      topHolders: analyzeData.topHolders,
      distribution: analyzeData.distribution,
    };
  } catch {
    return null;
  }
}

// ─── Main refresh handler ───

export async function GET(req: NextRequest) {
  // Prevent concurrent refreshes
  const lockKey = "trending:refresh:lock";
  const existingLock = await cacheGet<number>(lockKey);
  if (existingLock && Date.now() - existingLock < 55000) {
    // Refresh already running — return current cache or wait
    const cached = await cacheGet<any>("trending:results");
    if (cached) return NextResponse.json({ ...cached, status: "refresh_in_progress" });
    return NextResponse.json({ tokens: [], timestamp: Date.now(), sources: [], status: "refresh_in_progress" });
  }
  await cacheSet(lockKey, Date.now(), 60);

  const baseUrl = req.nextUrl.origin;

  try {
    // Fetch from all sources
    const [hot, live, graduated, active, boosted] = await Promise.all([
      getPumpHot(), getPumpLive(), getPumpGraduated(), getPumpMostTraded(), getDexBoosted(),
    ]);

    let tokens: TrendingToken[] = [...hot, ...live, ...graduated, ...active, ...boosted];

    // Deduplicate
    const seen = new Set<string>();
    tokens = tokens.filter(t => { if (seen.has(t.mint)) return false; seen.add(t.mint); return true; });

    // Run full scans — 3 at a time to respect Helius rate limits
    const toScan = tokens.slice(0, 20);
    const scored: ScoredToken[] = [];

    for (let i = 0; i < toScan.length; i += 3) {
      const batch = toScan.slice(i, i + 3);
      const results = await Promise.allSettled(
        batch.map(async (token) => {
          const scanResult = await fullScanToken(token.mint, baseUrl);
          if (!scanResult) return null;
          return { ...token, ...scanResult } as ScoredToken;
        })
      );
      for (const r of results) {
        if (r.status === "fulfilled" && r.value) scored.push(r.value);
      }
    }

    // Sort by score
    scored.sort((a, b) => b.score - a.score);

    const result = {
      tokens: scored,
      timestamp: Date.now(),
      sources: ["pump_hot", "pump_live", "pump_graduated", "pump_active", "dex_boosted"],
    };

    // Cache for 5 minutes
    await cacheSet("trending:results", result, 300);
    // Release lock
    await cacheSet(lockKey, 0, 1);

    return NextResponse.json({ ...result, status: "fresh" });
  } catch (err) {
    await cacheSet(lockKey, 0, 1);
    return NextResponse.json({ error: err instanceof Error ? err.message : "Refresh failed" }, { status: 500 });
  }
}
