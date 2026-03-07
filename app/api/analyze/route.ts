import { NextRequest, NextResponse } from "next/server";

const HELIUS_API_KEY = "2e5afdba-52c8-47bb-a203-d7571a17ade5";
const HELIUS_RPC = `https://mainnet.helius-rpc.com/?api-key=${HELIUS_API_KEY}`;

// Use Helius enhanced API — 1 call gets parsed transaction history
// Use DAS API for bulk operations
// Target: < 20 total RPC calls per analysis

interface WalletAnalysis {
  address: string;
  balance: number;
  walletAgeDays: number;
  holdDurationDays: number;
  totalTxCount: number;
  isFresh: boolean;
  solBalance: number;
  otherTokenCount: number;
}

async function heliusRpc(method: string, params: unknown[]) {
  const res = await fetch(HELIUS_RPC, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
  });
  const data = await res.json();
  if (data.error) throw new Error(data.error.message || JSON.stringify(data.error));
  return data.result;
}

// Single call: get top holders via getTokenLargestAccounts
async function getTopHolders(mint: string) {
  const result = await heliusRpc("getTokenLargestAccounts", [mint]);
  return result?.value || [];
}

// Single call: get account info for a token account (to find owner)
async function getTokenAccountOwner(tokenAccount: string) {
  const result = await heliusRpc("getAccountInfo", [
    tokenAccount,
    { encoding: "jsonParsed" },
  ]);
  const parsed = result?.value?.data?.parsed?.info;
  return {
    owner: parsed?.owner || null,
    amount: parseFloat(parsed?.tokenAmount?.uiAmountString || "0"),
    decimals: parsed?.tokenAmount?.decimals || 6,
  };
}

// Batch: get multiple account infos in one call
async function getMultipleAccounts(accounts: string[]) {
  const result = await heliusRpc("getMultipleAccountsInfo", [
    accounts,
    { encoding: "jsonParsed" },
  ]);
  return result?.value || [];
}

// Single call: get SOL balances for multiple accounts (not available as batch in standard RPC)
// Use getMultipleAccounts instead
async function getWalletInfo(wallet: string): Promise<{
  solBalance: number;
  firstTxTime: number | null;
  txCount: number;
  tokenCount: number;
}> {
  // Combine: get signatures (1 call for age + count estimate) + balance + tokens
  const [sigsResult, balResult, tokensResult] = await Promise.allSettled([
    // Get last page of signatures to estimate age — just 1 call, get oldest we can
    heliusRpc("getSignaturesForAddress", [wallet, { limit: 1000 }]),
    heliusRpc("getBalance", [wallet]),
    heliusRpc("getTokenAccountsByOwner", [
      wallet,
      { programId: "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA" },
      { encoding: "jsonParsed" },
    ]),
  ]);

  let firstTxTime: number | null = null;
  let txCount = 0;

  if (sigsResult.status === "fulfilled" && sigsResult.value) {
    const sigs = sigsResult.value;
    txCount = sigs.length; // Approximate — up to 1000
    if (sigs.length > 0) {
      // The last signature in the array is the oldest we fetched
      const oldest = sigs[sigs.length - 1];
      firstTxTime = oldest.blockTime ? oldest.blockTime * 1000 : null;
      
      // If we got exactly 1000, wallet has more history — try one more page
      if (sigs.length === 1000) {
        try {
          const older = await heliusRpc("getSignaturesForAddress", [
            wallet,
            { limit: 1000, before: oldest.signature },
          ]);
          if (older && older.length > 0) {
            txCount += older.length;
            const realOldest = older[older.length - 1];
            firstTxTime = realOldest.blockTime ? realOldest.blockTime * 1000 : firstTxTime;
          }
        } catch { /* keep what we have */ }
      }
    }
  }

  const solBalance = balResult.status === "fulfilled" ? (balResult.value?.value || 0) / 1e9 : 0;
  const tokenCount = tokensResult.status === "fulfilled" ? (tokensResult.value?.value?.length || 0) : 0;

  return { solBalance, firstTxTime, txCount, tokenCount };
}

async function getTokenMetadata(mint: string) {
  // Try pump.fun first (free, no rate limit)
  try {
    const res = await fetch(`https://frontend-api-v3.pump.fun/coins/${mint}`);
    if (res.ok) {
      const data = await res.json();
      if (data.name) return { name: data.name, symbol: data.symbol || "???" };
    }
  } catch { /* fall through */ }

  // Fallback: Helius token metadata (1 call)
  try {
    const res = await fetch(`https://api.helius.xyz/v0/token-metadata?api-key=${HELIUS_API_KEY}`, {
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
  } catch { /* ignore */ }

  return { name: "Unknown", symbol: "???" };
}

function median(arr: number[]): number {
  if (arr.length === 0) return 0;
  const sorted = [...arr].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

function bucketize(values: number[], buckets: { label: string; max: number }[]) {
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

    // Step 1: Get token metadata (1 call, or 0 if pump.fun works)
    const meta = await getTokenMetadata(mint);

    // Step 2: Get top 20 token accounts (1 RPC call)
    const topAccounts = await getTopHolders(mint);
    if (!topAccounts || topAccounts.length === 0) {
      return NextResponse.json({ error: "No holders found" }, { status: 404 });
    }

    // Step 3: Resolve owners — do sequentially to avoid rate limit
    // getTokenLargestAccounts returns token accounts, need to resolve owners
    const holders: { owner: string; amount: number; decimals: number }[] = [];
    
    for (const acc of topAccounts) {
      try {
        const info = await getTokenAccountOwner(acc.address);
        if (info.owner) {
          holders.push({
            owner: info.owner,
            amount: parseFloat(acc.uiAmountString || "0"),
            decimals: acc.decimals || 6,
          });
        }
        // Small delay between each
        await new Promise((r) => setTimeout(r, 100));
      } catch { /* skip */ }
    }

    if (holders.length === 0) {
      return NextResponse.json({ error: "Could not resolve holder wallets" }, { status: 404 });
    }

    const totalSupply = holders.reduce((s, h) => s + h.amount, 0);
    const now = Date.now();
    const wallets: WalletAnalysis[] = [];

    // Step 4: Analyze each wallet — sequentially with delays
    // Each wallet = ~3-4 RPC calls (sigs, balance, tokens)
    // 20 wallets × 3 calls = ~60 calls, spread over time
    for (let i = 0; i < holders.length; i++) {
      const holder = holders[i];
      try {
        const info = await getWalletInfo(holder.owner);
        
        const walletAgeDays = info.firstTxTime
          ? (now - info.firstTxTime) / (1000 * 60 * 60 * 24)
          : 0;

        wallets.push({
          address: holder.owner,
          balance: holder.amount,
          walletAgeDays: Math.round(walletAgeDays * 10) / 10,
          holdDurationDays: Math.round(walletAgeDays * 10) / 10,
          totalTxCount: info.txCount,
          isFresh: walletAgeDays < 7,
          solBalance: Math.round(info.solBalance * 1000) / 1000,
          otherTokenCount: info.tokenCount,
        });
      } catch (err) {
        console.error(`Failed to analyze ${holder.owner}:`, err);
      }

      // Rate limit: wait 300ms between wallets
      if (i < holders.length - 1) {
        await new Promise((r) => setTimeout(r, 300));
      }
    }

    if (wallets.length === 0) {
      return NextResponse.json({ error: "Analysis failed — rate limited" }, { status: 429 });
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

    const topHolders = wallets.map((w) => ({
      address: w.address,
      balancePct: totalSupply > 0 ? Math.round((w.balance / totalSupply) * 1000) / 10 : 0,
      walletAgeDays: w.walletAgeDays,
      holdDurationDays: w.holdDurationDays,
      totalTxCount: w.totalTxCount,
      isFresh: w.isFresh,
    }));

    const result = {
      mint,
      tokenName: meta.name,
      tokenSymbol: meta.symbol,
      totalHolders: topAccounts.length,
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
    const msg = err instanceof Error ? err.message : "Analysis failed";
    const status = msg.includes("max usage") || msg.includes("429") ? 429 : 500;
    return NextResponse.json({ error: msg }, { status });
  }
}
