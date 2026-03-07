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
  source: "pump_hot" | "pump_live" | "pump_graduated" | "pump_active" | "dex_boosted";
  boostAmount?: number;
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

async function quickScore(mint: string): Promise<{ holderCount: number; freshPct: number; avgWalletAgeDays: number; grade: string; score: number }> {
  try {
    // Get holders via DAS
    const res = await fetch(HELIUS_RPC, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "getTokenAccounts", params: { mint, limit: 100 } }),
      signal: AbortSignal.timeout(6000),
    });
    const data = await res.json();
    const accounts = data.result?.token_accounts || [];
    if (accounts.length === 0) return { holderCount: 0, freshPct: 0, avgWalletAgeDays: 0, grade: "?", score: 0 };

    const holderCount = accounts.length;
    const owners = accounts.slice(0, 50).map((a: any) => a.owner).filter(Boolean);

    // Quick wallet age check on sample
    let freshCount = 0;
    let totalAgeDays = 0;
    let checked = 0;

    // Batch check wallet ages via getSignaturesForAddress (oldest tx)
    const ageResults = await Promise.allSettled(
      owners.slice(0, 20).map(async (owner: string) => {
        const sigRes = await fetch(HELIUS_RPC, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "getSignaturesForAddress", params: [owner, { limit: 1 }] }),
          signal: AbortSignal.timeout(3000),
        });
        const sigData = await sigRes.json();
        const sigs = sigData.result || [];
        if (sigs.length > 0 && sigs[0].blockTime) {
          const ageDays = (Date.now() / 1000 - sigs[0].blockTime) / 86400;
          return { ageDays, fresh: ageDays < 7 };
        }
        return { ageDays: 0, fresh: true };
      })
    );

    for (const r of ageResults) {
      if (r.status === "fulfilled") {
        checked++;
        totalAgeDays += r.value.ageDays;
        if (r.value.fresh) freshCount++;
      }
    }

    const freshPct = checked > 0 ? Math.round((freshCount / checked) * 100) : 0;
    const avgWalletAgeDays = checked > 0 ? Math.round(totalAgeDays / checked) : 0;

    // Simple grade based on fresh wallet %
    let grade = "A";
    let score = 90;
    if (freshPct > 60) { grade = "F"; score = 20; }
    else if (freshPct > 45) { grade = "D"; score = 35; }
    else if (freshPct > 30) { grade = "C"; score = 50; }
    else if (freshPct > 15) { grade = "B"; score = 70; }
    else { grade = "A"; score = 90; }

    // Adjust for holder count
    if (holderCount < 20) { score = Math.max(score - 15, 10); if (grade < "C") grade = "C"; }

    return { holderCount, freshPct, avgWalletAgeDays, grade, score };
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
          const score = await quickScore(token.mint);
          return { ...token, ...score };
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
