import { NextRequest, NextResponse } from "next/server";
import { cacheSet, cacheGet } from "@/app/lib/cache";
import { runScan, generateVerdict } from "@/app/lib/scan-core";
import type { ScanMetrics, TopHolder } from "@/app/lib/scan-core";

// Node.js runtime — no 25s edge timeout
export const runtime = "nodejs";
export const maxDuration = 60;

interface TrendingToken {
  mint: string;
  name: string;
  symbol: string;
  image: string | null;
  marketCap: number;
  source: string;
  boostAmount?: number;
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
  topHolders?: TopHolder[];
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

// ─── Main refresh handler ───

export async function GET(req: NextRequest) {
  // Prevent concurrent refreshes
  const lockKey = "trending:refresh:lock";
  const existingLock = await cacheGet<number>(lockKey);
  if (existingLock && Date.now() - existingLock < 55000) {
    const cached = await cacheGet<any>("trending:results");
    if (cached) return NextResponse.json({ ...cached, status: "refresh_in_progress" });
    return NextResponse.json({ tokens: [], timestamp: Date.now(), sources: [], status: "refresh_in_progress" });
  }
  await cacheSet(lockKey, Date.now(), 65);

  try {
    // Fetch from all sources in parallel
    const [hot, live, graduated, active, boosted] = await Promise.all([
      getPumpHot(), getPumpLive(), getPumpGraduated(), getPumpMostTraded(), getDexBoosted(),
    ]);

    // Interleave sources so dedup doesn't kill any one category
    let tokens: TrendingToken[] = [];
    const sources = [graduated, hot, boosted, active, live];
    const maxLen = Math.max(...sources.map(s => s.length));
    for (let i = 0; i < maxLen; i++) {
      for (const src of sources) {
        if (i < src.length) tokens.push(src[i]);
      }
    }

    // Deduplicate
    const seen = new Set<string>();
    tokens = tokens.filter(t => { if (seen.has(t.mint)) return false; seen.add(t.mint); return true; });

    console.log(`[trending] ${tokens.length} unique tokens from ${sources.map(s => s.length).join('+')} sources`);

    // Run full scans — 2 at a time, 10 holders each to fit in 60s timeout
    const toScan = tokens.slice(0, 12);
    const scored: ScoredToken[] = [];

    for (let i = 0; i < toScan.length; i += 2) {
      const batch = toScan.slice(i, i + 2);
      const results = await Promise.allSettled(
        batch.map(async (token) => {
          try {
            const scanResult = await runScan(token.mint, 10);
            if (!scanResult) {
              console.log(`[trending] scan returned null for ${token.symbol} (${token.mint.slice(0,8)})`);
              return { ...token, holderCount: 0, freshPct: 0, avgWalletAgeDays: 0, grade: "?", score: 0 } as ScoredToken;
            }

            const verdict = generateVerdict(scanResult.metrics, scanResult.totalHolders, scanResult.tokenSymbol, null, token.mint);

            return {
              ...token,
              holderCount: scanResult.totalHolders,
              freshPct: scanResult.metrics.freshWalletPct,
              avgWalletAgeDays: scanResult.metrics.avgWalletAgeDays,
              grade: verdict.grade,
              score: verdict.score,
              verdict: verdict.verdict,
              flags: verdict.flags,
              metrics: scanResult.metrics,
              topHolders: scanResult.topHolders,
              distribution: scanResult.distribution,
            } as ScoredToken;
          } catch (err) {
            console.log(`[trending] error scanning ${token.symbol}:`, err);
            return { ...token, holderCount: 0, freshPct: 0, avgWalletAgeDays: 0, grade: "?", score: 0 } as ScoredToken;
          }
        })
      );
      for (const r of results) {
        if (r.status === "fulfilled" && r.value) scored.push(r.value);
      }
    }

    // Add remaining unscanned tokens
    const scannedMints = new Set(scored.map(t => t.mint));
    for (const token of tokens) {
      if (!scannedMints.has(token.mint)) {
        scored.push({ ...token, holderCount: 0, freshPct: 0, avgWalletAgeDays: 0, grade: "?", score: 0 });
      }
    }

    // Sort: graded tokens first (by score desc), then ungraded
    scored.sort((a, b) => {
      if (a.grade === "?" && b.grade !== "?") return 1;
      if (a.grade !== "?" && b.grade === "?") return -1;
      return b.score - a.score;
    });

    console.log(`[trending] ${scored.filter(t => t.grade !== "?").length}/${scored.length} tokens scanned successfully`);

    const result = {
      tokens: scored,
      timestamp: Date.now(),
      sources: ["pump_hot", "pump_live", "pump_graduated", "pump_active", "dex_boosted"],
    };

    // Cache for 5 minutes
    await cacheSet("trending:results", result, 300);
    await cacheSet(lockKey, 0, 1);

    return NextResponse.json({ ...result, status: "fresh" });
  } catch (err) {
    console.error("[trending] refresh failed:", err);
    await cacheSet(lockKey, 0, 1);
    return NextResponse.json({ error: err instanceof Error ? err.message : "Refresh failed" }, { status: 500 });
  }
}
