import { NextRequest, NextResponse } from "next/server";

const HELIUS_API_KEY = "65a496c3-0f36-4efe-a65a-67a716193997";
const HELIUS_RPC = `https://mainnet.helius-rpc.com/?api-key=${HELIUS_API_KEY}`;
const HELIUS_API = `https://api.helius.xyz/v0`;

interface HolderAccount {
  address: string; // wallet
  amount: number;
  decimals: number;
}

interface WalletAnalysis {
  address: string;
  balance: number;
  walletAgeDays: number;
  holdDurationDays: number;
  totalTxCount: number;
  isFresh: boolean; // wallet < 7 days old at time of first buy
  solBalance: number;
  otherTokenCount: number;
}

interface AnalysisResult {
  mint: string;
  tokenName: string;
  tokenSymbol: string;
  totalHolders: number;
  analyzedHolders: number;
  metrics: {
    avgWalletAgeDays: number;
    medianWalletAgeDays: number;
    avgHoldDurationDays: number;
    medianHoldDurationDays: number;
    freshWalletPct: number; // wallets < 7 days old
    veryFreshWalletPct: number; // wallets < 24 hrs old
    diamondHandsPct: number; // holding > 2 days
    veteranHolderPct: number; // wallet age > 90 days
    ogHolderPct: number; // wallet age > 180 days
    avgTxCount: number;
    lowActivityPct: number; // < 10 total txs ever
    avgSolBalance: number;
    singleTokenPct: number; // only hold this token (likely burner)
  };
  distribution: {
    walletAge: { label: string; count: number; pct: number }[];
    holdDuration: { label: string; count: number; pct: number }[];
  };
  topHolders: {
    address: string;
    balancePct: number;
    walletAgeDays: number;
    holdDurationDays: number;
    totalTxCount: number;
    isFresh: boolean;
  }[];
  wallets: WalletAnalysis[];
  timestamp: number;
}

async function heliusRpc(method: string, params: unknown[]) {
  const res = await fetch(HELIUS_RPC, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
  });
  const data = await res.json();
  if (data.error) throw new Error(data.error.message);
  return data.result;
}

async function getTokenAccounts(mint: string): Promise<HolderAccount[]> {
  // Use Helius DAS getTokenAccounts
  const res = await fetch(`${HELIUS_API}/token/holders?api-key=${HELIUS_API_KEY}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ mint, limit: 200 }),
  });
  
  if (!res.ok) {
    // Fallback: use RPC getTokenLargestAccounts + parse
    const largest = await heliusRpc("getTokenLargestAccounts", [mint]);
    if (!largest?.value) return [];
    
    const accounts: HolderAccount[] = [];
    for (const acc of largest.value.slice(0, 20)) {
      // Get account info to find owner
      const info = await heliusRpc("getAccountInfo", [acc.address, { encoding: "jsonParsed" }]);
      if (info?.value?.data?.parsed?.info?.owner) {
        accounts.push({
          address: info.value.data.parsed.info.owner,
          amount: parseFloat(acc.uiAmountString || acc.amount),
          decimals: acc.decimals,
        });
      }
    }
    return accounts;
  }
  
  const data = await res.json();
  return (data.holders || data || []).map((h: { owner: string; balance: number; decimals: number }) => ({
    address: h.owner,
    amount: h.balance,
    decimals: h.decimals || 6,
  }));
}

async function getTokenMetadata(mint: string) {
  try {
    const res = await fetch(`${HELIUS_API}/token-metadata?api-key=${HELIUS_API_KEY}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ mintAccounts: [mint], includeOffChain: true }),
    });
    const data = await res.json();
    if (data?.[0]) {
      const meta = data[0];
      return {
        name: meta.onChainMetadata?.metadata?.data?.name || meta.offChainMetadata?.metadata?.name || "Unknown",
        symbol: meta.onChainMetadata?.metadata?.data?.symbol || meta.offChainMetadata?.metadata?.symbol || "???",
      };
    }
  } catch {
    // Try pump.fun API
    try {
      const res = await fetch(`https://frontend-api-v3.pump.fun/coins/${mint}`);
      if (res.ok) {
        const data = await res.json();
        return { name: data.name || "Unknown", symbol: data.symbol || "???" };
      }
    } catch { /* ignore */ }
  }
  return { name: "Unknown", symbol: "???" };
}

async function getWalletFirstTx(wallet: string): Promise<number | null> {
  try {
    // Get oldest signature
    const sigs = await heliusRpc("getSignaturesForAddress", [
      wallet,
      { limit: 1, before: undefined },
    ]);
    
    if (!sigs || sigs.length === 0) return null;
    
    // To get the actual oldest, we need to paginate backwards
    // For speed, just get recent + use the last page approach
    let oldestSig = sigs[sigs.length - 1];
    let lastSig = oldestSig.signature;
    
    // Quick pagination to find oldest (max 5 pages = 5000 txs)
    for (let i = 0; i < 5; i++) {
      const older = await heliusRpc("getSignaturesForAddress", [
        wallet,
        { limit: 1000, before: lastSig },
      ]);
      if (!older || older.length === 0) break;
      oldestSig = older[older.length - 1];
      lastSig = oldestSig.signature;
      if (older.length < 1000) break;
    }
    
    return oldestSig.blockTime ? oldestSig.blockTime * 1000 : null;
  } catch {
    return null;
  }
}

async function getWalletTxCount(wallet: string): Promise<number> {
  try {
    let count = 0;
    let lastSig: string | undefined;
    for (let i = 0; i < 3; i++) {
      const params: Record<string, unknown> = { limit: 1000 };
      if (lastSig) params.before = lastSig;
      const sigs = await heliusRpc("getSignaturesForAddress", [wallet, params]);
      if (!sigs || sigs.length === 0) break;
      count += sigs.length;
      lastSig = sigs[sigs.length - 1].signature;
      if (sigs.length < 1000) break;
    }
    return count;
  } catch {
    return 0;
  }
}

async function getWalletSolBalance(wallet: string): Promise<number> {
  try {
    const result = await heliusRpc("getBalance", [wallet]);
    return (result?.value || 0) / 1e9;
  } catch {
    return 0;
  }
}

async function getWalletTokenCount(wallet: string): Promise<number> {
  try {
    const result = await heliusRpc("getTokenAccountsByOwner", [
      wallet,
      { programId: "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA" },
      { encoding: "jsonParsed" },
    ]);
    return result?.value?.length || 0;
  } catch {
    return 0;
  }
}

function median(arr: number[]): number {
  if (arr.length === 0) return 0;
  const sorted = [...arr].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

function bucketize(values: number[], buckets: { label: string; max: number }[]): { label: string; count: number; pct: number }[] {
  const counts = buckets.map((b) => ({ label: b.label, count: 0, pct: 0 }));
  for (const v of values) {
    for (let i = 0; i < buckets.length; i++) {
      if (v <= buckets[i].max || i === buckets.length - 1) {
        counts[i].count++;
        break;
      }
    }
  }
  const total = values.length || 1;
  counts.forEach((c) => (c.pct = Math.round((c.count / total) * 1000) / 10));
  return counts;
}

export async function POST(req: NextRequest) {
  try {
    const { mint } = await req.json();
    if (!mint || typeof mint !== "string") {
      return NextResponse.json({ error: "Missing mint address" }, { status: 400 });
    }

    // Get token metadata
    const meta = await getTokenMetadata(mint);

    // Get holders
    const holders = await getTokenAccounts(mint);
    if (!holders || holders.length === 0) {
      return NextResponse.json({ error: "No holders found" }, { status: 404 });
    }

    // Sort by balance desc, analyze top 100
    const sorted = holders.sort((a, b) => b.amount - a.amount);
    const totalSupply = sorted.reduce((s, h) => s + h.amount, 0);
    const toAnalyze = sorted.slice(0, 100);
    
    const now = Date.now();
    const wallets: WalletAnalysis[] = [];

    // Batch analyze wallets — process in parallel batches of 10
    for (let i = 0; i < toAnalyze.length; i += 10) {
      const batch = toAnalyze.slice(i, i + 10);
      const results = await Promise.all(
        batch.map(async (holder) => {
          const [firstTx, txCount, solBal, tokenCount] = await Promise.all([
            getWalletFirstTx(holder.address),
            getWalletTxCount(holder.address),
            getWalletSolBalance(holder.address),
            getWalletTokenCount(holder.address),
          ]);

          const walletAgeDays = firstTx ? (now - firstTx) / (1000 * 60 * 60 * 24) : 0;
          
          // Hold duration: approximate from first tx (we'd need token-specific tx parsing for exact)
          // For now, use wallet age as upper bound — we'll refine with parsed txs later
          const holdDurationDays = walletAgeDays; // TODO: parse actual token buy time

          return {
            address: holder.address,
            balance: holder.amount / Math.pow(10, holder.decimals),
            walletAgeDays: Math.round(walletAgeDays * 10) / 10,
            holdDurationDays: Math.round(holdDurationDays * 10) / 10,
            totalTxCount: txCount,
            isFresh: walletAgeDays < 7,
            solBalance: Math.round(solBal * 1000) / 1000,
            otherTokenCount: tokenCount,
          };
        })
      );
      wallets.push(...results);
      
      // Small delay between batches to respect rate limits
      if (i + 10 < toAnalyze.length) {
        await new Promise((r) => setTimeout(r, 200));
      }
    }

    // Compute metrics
    const ages = wallets.map((w) => w.walletAgeDays);
    const holds = wallets.map((w) => w.holdDurationDays);
    const txCounts = wallets.map((w) => w.totalTxCount);

    const metrics = {
      avgWalletAgeDays: Math.round((ages.reduce((s, v) => s + v, 0) / ages.length) * 10) / 10,
      medianWalletAgeDays: Math.round(median(ages) * 10) / 10,
      avgHoldDurationDays: Math.round((holds.reduce((s, v) => s + v, 0) / holds.length) * 10) / 10,
      medianHoldDurationDays: Math.round(median(holds) * 10) / 10,
      freshWalletPct: Math.round((wallets.filter((w) => w.walletAgeDays < 7).length / wallets.length) * 1000) / 10,
      veryFreshWalletPct: Math.round((wallets.filter((w) => w.walletAgeDays < 1).length / wallets.length) * 1000) / 10,
      diamondHandsPct: Math.round((wallets.filter((w) => w.holdDurationDays > 2).length / wallets.length) * 1000) / 10,
      veteranHolderPct: Math.round((wallets.filter((w) => w.walletAgeDays > 90).length / wallets.length) * 1000) / 10,
      ogHolderPct: Math.round((wallets.filter((w) => w.walletAgeDays > 180).length / wallets.length) * 1000) / 10,
      avgTxCount: Math.round(txCounts.reduce((s, v) => s + v, 0) / txCounts.length),
      lowActivityPct: Math.round((wallets.filter((w) => w.totalTxCount < 10).length / wallets.length) * 1000) / 10,
      avgSolBalance: Math.round((wallets.reduce((s, w) => s + w.solBalance, 0) / wallets.length) * 100) / 100,
      singleTokenPct: Math.round((wallets.filter((w) => w.otherTokenCount <= 1).length / wallets.length) * 1000) / 10,
    };

    // Distributions
    const ageBuckets = [
      { label: "< 1 day", max: 1 },
      { label: "1-7 days", max: 7 },
      { label: "7-30 days", max: 30 },
      { label: "30-90 days", max: 90 },
      { label: "90-180 days", max: 180 },
      { label: "180+ days", max: Infinity },
    ];

    const holdBuckets = [
      { label: "< 1 hour", max: 1 / 24 },
      { label: "1-24 hours", max: 1 },
      { label: "1-7 days", max: 7 },
      { label: "7-30 days", max: 30 },
      { label: "30+ days", max: Infinity },
    ];

    // Top holders with analysis
    const topHolders = wallets.slice(0, 20).map((w) => ({
      address: w.address,
      balancePct: Math.round((w.balance / (totalSupply / Math.pow(10, sorted[0]?.decimals || 6))) * 1000) / 10,
      walletAgeDays: w.walletAgeDays,
      holdDurationDays: w.holdDurationDays,
      totalTxCount: w.totalTxCount,
      isFresh: w.isFresh,
    }));

    const result: AnalysisResult = {
      mint,
      tokenName: meta.name,
      tokenSymbol: meta.symbol,
      totalHolders: holders.length,
      analyzedHolders: wallets.length,
      metrics,
      distribution: {
        walletAge: bucketize(ages, ageBuckets),
        holdDuration: bucketize(holds, holdBuckets),
      },
      topHolders,
      wallets,
      timestamp: now,
    };

    return NextResponse.json(result);
  } catch (err) {
    console.error("Analysis error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Analysis failed" },
      { status: 500 }
    );
  }
}
