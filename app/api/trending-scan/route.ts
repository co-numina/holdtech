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

// Known pool/program addresses — exclude from holder quality metrics
const KNOWN_PROGRAMS = new Set([
  "5Q544fKrFoe6tsEbD7S8EmxGTJYAKtTVhAW5Q5pge4j1", "675kPX9MHTjS2zt1qfr1NYHuzeLXfQM9H24wFSUt1Mp8",
  "CPMMoo8L3F4NbTegBCKVNunggL7H1ZpdTHKxQB5qKP1C", "CAMMCzo5YL8w4VFF8KVHrK22GGUsp5VTaW7grrKgrWqK",
  "whirLbMiicVdio4qvUfM5KAg6Ct8VwpYzGff3uctyCc", "9W959DqEETiGZocYWCQPaJ6sBmUzgfxXfqGeTEdp3aQP",
  "LBUZKhRxPF3XUpBCjp4YzTKgLccjZhTSDM9YuVaPwxo", "Eo7WjKq67rjJQSZxS6z3YkapzY3eMj6Xy8X5EQVn5UaB",
  "PSwapMdSai8tjrEXcxFeQth87xC4rRsa4VA5mhGhXkP", "6EF8rrecthR5Dkzon8Nwu78hRvfCKubJ14M5uBEwF6P",
  "Ce6TQqeHC9p8KetsN6JsjHK7UTZk7nasjjnr7XxXp18W", "39azUYFWPz3VHgKCf3VChUwbpURdCHRxjWVowf5jUJjg",
]);

async function heliusRpc(method: string, params: unknown[]) {
  const res = await fetch(HELIUS_RPC, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
    signal: AbortSignal.timeout(6000),
  });
  const data = await res.json();
  if (data.error) throw new Error(data.error.message || JSON.stringify(data.error));
  return data.result;
}

async function getWalletInfo(wallet: string): Promise<{ solBalance: number; firstTxTime: number | null; txCount: number; tokenCount: number }> {
  const [sigsResult, balResult, tokensResult] = await Promise.allSettled([
    heliusRpc("getSignaturesForAddress", [wallet, { limit: 1000 }]),
    heliusRpc("getBalance", [wallet]),
    heliusRpc("getTokenAccountsByOwner", [wallet, { programId: "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA" }, { encoding: "jsonParsed" }]),
  ]);
  const sigs = sigsResult.status === "fulfilled" ? (sigsResult.value || []) : [];
  const bal = balResult.status === "fulfilled" ? (balResult.value || 0) : 0;
  const tokens = tokensResult.status === "fulfilled" ? (tokensResult.value?.value || []) : [];
  const oldest = sigs.length > 0 ? sigs[sigs.length - 1]?.blockTime : null;
  return {
    solBalance: typeof bal === "number" ? bal / 1e9 : 0,
    firstTxTime: oldest ? oldest * 1000 : null,
    txCount: sigs.length,
    tokenCount: tokens.length,
  };
}

// Same scoring logic as ai-verdict — keeps trending grades consistent with individual scans
function computeVerdict(metrics: {
  freshWalletPct: number; veryFreshWalletPct: number; veteranHolderPct: number;
  ogHolderPct: number; lowActivityPct: number; singleTokenPct: number;
  avgTxCount: number; avgSolBalance: number; avgWalletAgeDays: number;
}, holderCount: number): { grade: string; score: number; freshPct: number; avgWalletAgeDays: number } {
  let score = 50;

  // Fresh wallets
  if (metrics.freshWalletPct > 80) score -= 30;
  else if (metrics.freshWalletPct > 60) score -= 22;
  else if (metrics.freshWalletPct > 40) score -= 12;
  else if (metrics.freshWalletPct < 20) score += 10;

  // Very fresh
  if (metrics.veryFreshWalletPct > 50) score -= 20;
  else if (metrics.veryFreshWalletPct > 30) score -= 12;
  else if (metrics.veryFreshWalletPct > 15) score -= 5;

  // Veterans
  if (metrics.veteranHolderPct > 40) score += 15;
  else if (metrics.veteranHolderPct > 20) score += 8;
  else if (metrics.veteranHolderPct < 10) score -= 10;

  // OG
  if (metrics.ogHolderPct > 30) score += 10;
  else if (metrics.ogHolderPct > 15) score += 5;

  // Low activity
  if (metrics.lowActivityPct > 70) score -= 20;
  else if (metrics.lowActivityPct > 50) score -= 15;
  else if (metrics.lowActivityPct > 30) score -= 8;
  else if (metrics.lowActivityPct < 15) score += 8;

  // Single token
  if (metrics.singleTokenPct > 60) score -= 22;
  else if (metrics.singleTokenPct > 40) score -= 15;
  else if (metrics.singleTokenPct > 20) score -= 8;

  // Tx count
  if (metrics.avgTxCount > 500) score += 8;
  else if (metrics.avgTxCount < 50) score -= 5;

  // SOL balance
  if (metrics.avgSolBalance > 5) score += 5;
  else if (metrics.avgSolBalance < 0.5) score -= 8;

  score = Math.max(0, Math.min(100, score));
  let grade: string;
  if (score >= 80) grade = "A";
  else if (score >= 65) grade = "B";
  else if (score >= 50) grade = "C";
  else if (score >= 35) grade = "D";
  else grade = "F";

  return { grade, score, freshPct: metrics.freshWalletPct, avgWalletAgeDays: metrics.avgWalletAgeDays };
}

async function quickScore(mint: string): Promise<{ holderCount: number; freshPct: number; avgWalletAgeDays: number; grade: string; score: number }> {
  try {
    // Step 1: Get top 10 holder token accounts
    const topAccounts = await heliusRpc("getTokenLargestAccounts", [mint]);
    const accounts = topAccounts?.value || [];
    if (accounts.length === 0) return { holderCount: 0, freshPct: 0, avgWalletAgeDays: 0, grade: "?", score: 0 };

    // Step 2: Resolve owners from token accounts (batch via getMultipleAccounts)
    const accountAddresses = accounts.slice(0, 10).map((a: any) => a.address);
    const multiRes = await heliusRpc("getMultipleAccounts", [accountAddresses, { encoding: "jsonParsed" }]);
    const accountInfos = multiRes || [];

    const holders: { owner: string; amount: number }[] = [];
    for (let i = 0; i < accountInfos.length; i++) {
      const info = accountInfos[i];
      if (!info) continue;
      const parsed = info.data?.parsed?.info;
      if (parsed?.owner) {
        holders.push({ owner: parsed.owner, amount: parseFloat(parsed.tokenAmount?.uiAmountString || "0") });
      }
    }

    // Filter out pools (first holder often pool + known programs)
    const humanHolders = holders.filter((h, i) => !KNOWN_PROGRAMS.has(h.owner) && (i > 0 || !KNOWN_PROGRAMS.has(h.owner)));
    // Also skip first holder if it looks like a pool (top holder of graduated tokens)
    const toAnalyze = humanHolders.length > 0 ? humanHolders : holders;

    // Get holder count from DAS
    let holderCount = accounts.length;
    try {
      const hRes = await fetch(HELIUS_RPC, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "getTokenAccounts", params: { mint, limit: 1000 } }),
        signal: AbortSignal.timeout(5000),
      });
      const hData = await hRes.json();
      holderCount = hData.result?.token_accounts?.length || holderCount;
    } catch {}

    // Step 3: Analyze wallets — same as main scan but only top 10
    const now = Date.now();
    const walletData: { ageDays: number; txCount: number; tokenCount: number; solBalance: number }[] = [];

    // Analyze in parallel (all at once — only 10 wallets, 3 calls each = 30 calls)
    const results = await Promise.allSettled(
      toAnalyze.slice(0, 10).map(async (h) => {
        const info = await getWalletInfo(h.owner);
        const ageDays = info.firstTxTime ? (now - info.firstTxTime) / (1000 * 60 * 60 * 24) : 0;
        return { ageDays, txCount: info.txCount, tokenCount: info.tokenCount, solBalance: info.solBalance };
      })
    );
    for (const r of results) {
      if (r.status === "fulfilled") walletData.push(r.value);
    }

    if (walletData.length === 0) return { holderCount, freshPct: 0, avgWalletAgeDays: 0, grade: "?", score: 0 };

    // Step 4: Compute same metrics as main analyze endpoint
    const total = walletData.length;
    const ages = walletData.map(w => w.ageDays);
    const metrics = {
      freshWalletPct: Math.round((walletData.filter(w => w.ageDays < 7).length / total) * 1000) / 10,
      veryFreshWalletPct: Math.round((walletData.filter(w => w.ageDays < 1).length / total) * 1000) / 10,
      veteranHolderPct: Math.round((walletData.filter(w => w.ageDays > 90).length / total) * 1000) / 10,
      ogHolderPct: Math.round((walletData.filter(w => w.ageDays > 180).length / total) * 1000) / 10,
      lowActivityPct: Math.round((walletData.filter(w => w.txCount < 10).length / total) * 1000) / 10,
      singleTokenPct: Math.round((walletData.filter(w => w.tokenCount <= 1).length / total) * 1000) / 10,
      avgTxCount: Math.round(walletData.reduce((s, w) => s + w.txCount, 0) / total),
      avgSolBalance: Math.round((walletData.reduce((s, w) => s + w.solBalance, 0) / total) * 100) / 100,
      avgWalletAgeDays: Math.round((ages.reduce((s, v) => s + v, 0) / ages.length) * 10) / 10,
    };

    // Step 5: Same verdict scoring as ai-verdict
    return { holderCount, ...computeVerdict(metrics, holderCount) };
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

    // Score top 8 tokens — each runs real holder analysis (~30 RPC calls each)
    // Must fit within 25s edge timeout
    const toScore = tokens.slice(0, 8);
    const scored: ScoredToken[] = [];

    // Score in batches of 4 (parallel wallet analysis)
    for (let i = 0; i < toScore.length; i += 4) {
      const batch = toScore.slice(i, i + 4);
      const results = await Promise.allSettled(
        batch.map(async (token) => {
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
