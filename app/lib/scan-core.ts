/**
 * Core holder quality scan logic — shared between /api/analyze and /api/trending-refresh.
 * No HTTP self-calls needed.
 */

const HELIUS_API_KEY = process.env.HELIUS_API_KEY || "2e5afdba-52c8-47bb-a203-d7571a17ade5";
const HELIUS_RPC = `https://mainnet.helius-rpc.com/?api-key=${HELIUS_API_KEY}`;

const KNOWN_PROGRAMS = new Set([
  "5Q544fKrFoe6tsEbD7S8EmxGTJYAKtTVhAW5Q5pge4j1",
  "675kPX9MHTjS2zt1qfr1NYHuzeLXfQM9H24wFSUt1Mp8",
  "CPMMoo8L3F4NbTegBCKVNunggL7H1ZpdTHKxQB5qKP1C",
  "CAMMCzo5YL8w4VFF8KVHrK22GGUsp5VTaW7grrKgrWqK",
  "whirLbMiicVdio4qvUfM5KAg6Ct8VwpYzGff3uctyCc",
  "9W959DqEETiGZocYWCQPaJ6sBmUzgfxXfqGeTEdp3aQP",
  "LBUZKhRxPF3XUpBCjp4YzTKgLccjZhTSDM9YuVaPwxo",
  "Eo7WjKq67rjJQSZxS6z3YkapzY3eMj6Xy8X5EQVn5UaB",
  "PSwapMdSai8tjrEXcxFeQth87xC4rRsa4VA5mhGhXkP",
  "6EF8rrecthR5Dkzon8Nwu78hRvfCKubJ14M5uBEwF6P",
  "Ce6TQqeHC9p8KetsN6JsjHK7UTZk7nasjjnr7XxXp18W",
  "39azUYFWPz3VHgKCf3VChUwbpURdCHRxjWVowf5jUJjg",
]);

const HOLDTECH_MINT = "ENvMgAAzKRffbMpKWzNmZxmRTmNhjNFNazbEJjsJpump";

export interface ScanMetrics {
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

export interface TopHolder {
  address: string;
  balancePct: number;
  walletAgeDays: number;
  holdDurationDays: number;
  totalTxCount: number;
  isFresh: boolean;
  isPool: boolean;
}

export interface ScanResult {
  mint: string;
  tokenName: string;
  tokenSymbol: string;
  totalHolders: number;
  analyzedHolders: number;
  metrics: ScanMetrics;
  distribution: {
    walletAge: { label: string; count: number; pct: number }[];
    holdDuration: { label: string; count: number; pct: number }[];
  };
  topHolders: TopHolder[];
  totalSupply: number;
  timestamp: number;
}

export interface VerdictResult {
  score: number;
  grade: string;
  verdict: string;
  flags: string[];
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

async function getTopHolders(mint: string) {
  const result = await heliusRpc("getTokenLargestAccounts", [mint]);
  return result?.value || [];
}

async function getTokenAccountOwner(tokenAccount: string) {
  const result = await heliusRpc("getAccountInfo", [tokenAccount, { encoding: "jsonParsed" }]);
  const parsed = result?.value?.data?.parsed?.info;
  return {
    owner: parsed?.owner || null,
    amount: parseFloat(parsed?.tokenAmount?.uiAmountString || "0"),
    decimals: parsed?.tokenAmount?.decimals || 6,
  };
}

async function getWalletInfo(wallet: string) {
  const [sigsResult, balResult, tokensResult] = await Promise.allSettled([
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
    txCount = sigs.length;
    if (sigs.length > 0) {
      const oldest = sigs[sigs.length - 1];
      firstTxTime = oldest.blockTime ? oldest.blockTime * 1000 : null;
      if (sigs.length === 1000) {
        try {
          const older = await heliusRpc("getSignaturesForAddress", [wallet, { limit: 1000, before: oldest.signature }]);
          if (older && older.length > 0) {
            txCount += older.length;
            const realOldest = older[older.length - 1];
            firstTxTime = realOldest.blockTime ? realOldest.blockTime * 1000 : firstTxTime;
          }
        } catch {}
      }
    }
  }

  const solBalance = balResult.status === "fulfilled" ? ((balResult.value as any)?.value || balResult.value || 0) / 1e9 : 0;
  const tokenCount = tokensResult.status === "fulfilled" ? ((tokensResult.value as any)?.value?.length || 0) : 0;

  return { solBalance: typeof solBalance === "number" ? solBalance : 0, firstTxTime, txCount, tokenCount };
}

async function getTokenMetadata(mint: string) {
  try {
    const res = await fetch(`https://frontend-api-v3.pump.fun/coins/${mint}`, { signal: AbortSignal.timeout(4000) });
    if (res.ok) {
      const data = await res.json();
      if (data.name) return { name: data.name, symbol: data.symbol || "???" };
    }
  } catch {}
  try {
    const res = await fetch(`https://api.helius.xyz/v0/token-metadata?api-key=${HELIUS_API_KEY}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ mintAccounts: [mint], includeOffChain: true }),
    });
    const data = await res.json();
    if (data?.[0]) {
      const m = data[0];
      return {
        name: m.onChainMetadata?.metadata?.data?.name || m.offChainMetadata?.metadata?.name || "Unknown",
        symbol: m.onChainMetadata?.metadata?.data?.symbol || m.offChainMetadata?.metadata?.symbol || "???",
      };
    }
  } catch {}
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
      if (v <= buckets[i].max || i === buckets.length - 1) { counts[i].count++; break; }
    }
  }
  const total = values.length || 1;
  counts.forEach((c) => (c.pct = Math.round((c.count / total) * 1000) / 10));
  return counts;
}

/**
 * Run the full holder quality scan on a token.
 * Same logic as /api/analyze — no HTTP calls to self.
 */
export async function runScan(mint: string, limit: number = 20): Promise<ScanResult | null> {
  try {
    const meta = await getTokenMetadata(mint);
    const [supplyResult, topAccounts] = await Promise.all([
      heliusRpc("getTokenSupply", [mint]),
      getTopHolders(mint),
    ]);
    const totalSupplyRaw = parseFloat(supplyResult?.value?.uiAmountString || "0");
    if (!topAccounts || topAccounts.length === 0) return null;

    const realHolderCount = topAccounts.length;
    const holders: { owner: string; amount: number; decimals: number }[] = [];

    for (const acc of topAccounts) {
      try {
        const info = await getTokenAccountOwner(acc.address);
        if (info.owner) {
          holders.push({ owner: info.owner, amount: parseFloat(acc.uiAmountString || "0"), decimals: acc.decimals || 6 });
        }
        await new Promise((r) => setTimeout(r, 30));
      } catch {}
    }

    if (limit > holders.length) {
      try {
        const existingOwners = new Set(holders.map(h => h.owner));
        let page = 1;
        while (holders.length < limit) {
          const dasRes = await fetch(HELIUS_RPC, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ jsonrpc: "2.0", id: `das-${page}`, method: "getTokenAccounts", params: { mint, limit: 100, page } }),
          });
          const dasData = await dasRes.json();
          const accounts = dasData.result?.token_accounts || [];
          if (accounts.length === 0) break;
          for (const acc of accounts) {
            if (holders.length >= limit) break;
            const owner = acc.owner;
            if (!owner || existingOwners.has(owner)) continue;
            existingOwners.add(owner);
            holders.push({ owner, amount: acc.amount ? parseFloat(acc.amount) / Math.pow(10, acc.decimals || 6) : 0, decimals: acc.decimals || 6 });
          }
          page++;
          if (accounts.length < 100) break;
        }
      } catch {}
    }

    if (holders.length === 0) return null;

    const totalSupply = totalSupplyRaw > 0 ? totalSupplyRaw : holders.reduce((s, h) => s + h.amount, 0);
    const now = Date.now();

    interface WalletData {
      address: string; balance: number; walletAgeDays: number; holdDurationDays: number;
      totalTxCount: number; isFresh: boolean; solBalance: number; otherTokenCount: number; isPool: boolean;
    }
    const wallets: WalletData[] = [];

    const poolDetected = new Set<string>();
    if (holders.length > 0) poolDetected.add(holders[0].owner);
    const isPoolOrProgram = (addr: string) => KNOWN_PROGRAMS.has(addr) || poolDetected.has(addr);

    const freshThreshold = mint === HOLDTECH_MINT ? 1 : 7;

    for (let i = 0; i < holders.length; i += 10) {
      const batch = holders.slice(i, i + 10);
      const results = await Promise.allSettled(
        batch.map(async (holder) => {
          const info = await getWalletInfo(holder.owner);
          const ageDays = info.firstTxTime ? (now - info.firstTxTime) / (1000 * 60 * 60 * 24) : 0;
          return {
            address: holder.owner, balance: holder.amount,
            walletAgeDays: Math.round(ageDays * 10) / 10,
            holdDurationDays: Math.round(ageDays * 10) / 10,
            totalTxCount: info.txCount,
            isFresh: ageDays < freshThreshold,
            solBalance: Math.round(info.solBalance * 1000) / 1000,
            otherTokenCount: info.tokenCount,
            isPool: isPoolOrProgram(holder.owner),
          };
        })
      );
      for (const r of results) { if (r.status === "fulfilled") wallets.push(r.value); }
      if (i + 10 < holders.length) await new Promise((r) => setTimeout(r, 30));
    }

    const humanWallets = wallets.filter((w) => !w.isPool);
    if (humanWallets.length === 0) return null;

    const ages = humanWallets.map((w) => w.walletAgeDays);
    const holds = humanWallets.map((w) => w.holdDurationDays);
    const txCounts = humanWallets.map((w) => w.totalTxCount);

    const metrics: ScanMetrics = {
      avgWalletAgeDays: Math.round((ages.reduce((s, v) => s + v, 0) / ages.length) * 10) / 10,
      medianWalletAgeDays: Math.round(median(ages) * 10) / 10,
      avgHoldDurationDays: Math.round((holds.reduce((s, v) => s + v, 0) / holds.length) * 10) / 10,
      medianHoldDurationDays: Math.round(median(holds) * 10) / 10,
      freshWalletPct: Math.round((humanWallets.filter((w) => w.walletAgeDays < freshThreshold).length / humanWallets.length) * 1000) / 10,
      veryFreshWalletPct: Math.round((humanWallets.filter((w) => w.walletAgeDays < (mint === HOLDTECH_MINT ? 0.25 : 1)).length / humanWallets.length) * 1000) / 10,
      diamondHandsPct: Math.round((humanWallets.filter((w) => w.holdDurationDays > 2).length / humanWallets.length) * 1000) / 10,
      veteranHolderPct: Math.round((humanWallets.filter((w) => w.walletAgeDays > 90).length / humanWallets.length) * 1000) / 10,
      ogHolderPct: Math.round((humanWallets.filter((w) => w.walletAgeDays > 180).length / humanWallets.length) * 1000) / 10,
      avgTxCount: Math.round(txCounts.reduce((s, v) => s + v, 0) / txCounts.length),
      lowActivityPct: Math.round((humanWallets.filter((w) => w.totalTxCount < 10).length / humanWallets.length) * 1000) / 10,
      avgSolBalance: Math.round((humanWallets.reduce((s, w) => s + w.solBalance, 0) / humanWallets.length) * 100) / 100,
      singleTokenPct: Math.round((humanWallets.filter((w) => w.otherTokenCount <= 1).length / humanWallets.length) * 1000) / 10,
    };

    const ageBuckets = [
      { label: "< 1 day", max: 1 }, { label: "1-7 days", max: 7 }, { label: "7-30 days", max: 30 },
      { label: "30-90 days", max: 90 }, { label: "90-180 days", max: 180 }, { label: "180+ days", max: Infinity },
    ];
    const holdBuckets = [
      { label: "< 1 hour", max: 1 / 24 }, { label: "1-24 hours", max: 1 },
      { label: "1-7 days", max: 7 }, { label: "7-30 days", max: 30 }, { label: "30+ days", max: Infinity },
    ];

    const topHolders: TopHolder[] = wallets.map((w) => ({
      address: w.address,
      balancePct: totalSupply > 0 ? Math.round((w.balance / totalSupply) * 1000) / 10 : 0,
      walletAgeDays: w.walletAgeDays,
      holdDurationDays: w.holdDurationDays,
      totalTxCount: w.totalTxCount,
      isFresh: w.isFresh,
      isPool: w.isPool,
    }));

    return {
      mint, tokenName: meta.name, tokenSymbol: meta.symbol,
      totalHolders: realHolderCount, analyzedHolders: wallets.length,
      metrics, distribution: { walletAge: bucketize(ages, ageBuckets), holdDuration: bucketize(holds, holdBuckets) },
      topHolders, totalSupply, timestamp: now,
    };
  } catch (err) {
    console.error(`[scan-core] scan failed for ${mint}:`, err);
    return null;
  }
}

/**
 * Generate verdict from scan metrics — same logic as /api/ai-verdict.
 */
export function generateVerdict(metrics: ScanMetrics, totalHolders: number, tokenSymbol: string, tokenAgeHours: number | null, mint?: string): VerdictResult {
  let score = 50;
  const flags: string[] = [];
  const isNewLaunch = tokenAgeHours !== null && tokenAgeHours < 24;

  if (tokenAgeHours !== null && tokenAgeHours < 1) {
    flags.push(`🆕 Token launched ${tokenAgeHours < 0.1 ? "minutes" : `${Math.round(tokenAgeHours * 60)} minutes`} ago — early-stage metrics`);
  } else if (tokenAgeHours !== null && tokenAgeHours < 6) {
    flags.push(`🆕 Token launched ${Math.round(tokenAgeHours)} hours ago — holderbase still forming`);
  } else if (isNewLaunch) {
    flags.push(`🆕 Token launched ${Math.round(tokenAgeHours!)} hours ago`);
  }

  if (metrics.freshWalletPct > 80) { score -= 30; flags.push(`🚨 ${metrics.freshWalletPct}% fresh wallets (<7d) — extreme sybil/cabal signal`); }
  else if (metrics.freshWalletPct > 60) { score -= 22; flags.push(`🚨 ${metrics.freshWalletPct}% fresh wallets (<7d) — high manufactured holder probability`); }
  else if (metrics.freshWalletPct > 40) { score -= 12; flags.push(`⚠️ ${metrics.freshWalletPct}% fresh wallets (<7d) — elevated risk`); }
  else if (metrics.freshWalletPct < 20) { score += 10; flags.push(`✅ Only ${metrics.freshWalletPct}% fresh wallets — holderbase looks organic`); }

  if (metrics.veryFreshWalletPct > 50) { score -= 20; flags.push(`🚨 ${metrics.veryFreshWalletPct}% wallets created within 24 hours — coordinated wallet creation`); }
  else if (metrics.veryFreshWalletPct > 30) { score -= 12; flags.push(`⚠️ ${metrics.veryFreshWalletPct}% wallets created in last 24hrs — likely sybil`); }
  else if (metrics.veryFreshWalletPct > 15) { score -= 5; flags.push(`⚠️ ${metrics.veryFreshWalletPct}% very fresh wallets — worth monitoring`); }

  if (metrics.veteranHolderPct > 40) { score += 15; flags.push(`✅ ${metrics.veteranHolderPct}% veteran wallets (90d+) — mature, experienced base`); }
  else if (metrics.veteranHolderPct > 20) { score += 8; flags.push(`👍 ${metrics.veteranHolderPct}% veteran wallets (90d+) — decent experienced mix`); }
  else if (metrics.veteranHolderPct < 10) { score -= 10; flags.push(`⚠️ Only ${metrics.veteranHolderPct}% veteran wallets — mostly newcomer/disposable wallets`); }

  if (metrics.ogHolderPct > 30) { score += 10; flags.push(`✅ ${metrics.ogHolderPct}% OG wallets (180d+) — strong long-term presence`); }
  else if (metrics.ogHolderPct > 15) { score += 5; }

  if (metrics.lowActivityPct > 70) { score -= 20; flags.push(`🚨 ${metrics.lowActivityPct}% holders have <10 total txs — burner wallets`); }
  else if (metrics.lowActivityPct > 50) { score -= 15; flags.push(`🚨 ${metrics.lowActivityPct}% low-activity wallets (<10 txs) — likely burners`); }
  else if (metrics.lowActivityPct > 30) { score -= 8; flags.push(`⚠️ ${metrics.lowActivityPct}% low-activity wallets — some burners in the mix`); }
  else if (metrics.lowActivityPct < 15) { score += 8; flags.push(`✅ Low burner rate — only ${metrics.lowActivityPct}% have <10 lifetime txs`); }

  if (metrics.singleTokenPct > 60) { score -= 22; flags.push(`🚨 ${metrics.singleTokenPct}% single-token wallets — textbook sybil pattern`); }
  else if (metrics.singleTokenPct > 40) { score -= 15; flags.push(`🚨 ${metrics.singleTokenPct}% single-token wallets — strong sybil/airdrop signal`); }
  else if (metrics.singleTokenPct > 20) { score -= 8; flags.push(`⚠️ ${metrics.singleTokenPct}% single-token wallets — elevated burner risk`); }

  if (metrics.avgTxCount > 500) { score += 8; flags.push(`✅ Average ${metrics.avgTxCount} txs per wallet — active, experienced traders`); }
  else if (metrics.avgTxCount < 50) { score -= 5; flags.push(`⚠️ Average only ${metrics.avgTxCount} txs per wallet — inactive holders`); }

  if (metrics.avgSolBalance > 5) { score += 5; flags.push(`✅ Average ${metrics.avgSolBalance} SOL per wallet — holders have capital`); }
  else if (metrics.avgSolBalance < 0.5) { score -= 8; flags.push(`⚠️ Average only ${metrics.avgSolBalance} SOL — dust wallets, low conviction`); }

  if (totalHolders < 50) flags.push(`ℹ️ ${totalHolders} total holders — very early stage`);
  else if (totalHolders > 5000) flags.push(`ℹ️ ${totalHolders.toLocaleString()} total holders — widely distributed`);
  else if (totalHolders > 1000) flags.push(`ℹ️ ${totalHolders.toLocaleString()} total holders — well-distributed`);

  score = Math.max(0, Math.min(100, score));

  let grade: string;
  if (score >= 80) grade = "A";
  else if (score >= 65) grade = "B";
  else if (score >= 50) grade = "C";
  else if (score >= 35) grade = "D";
  else grade = "F";

  let verdict: string;
  if (score >= 80) verdict = `$${tokenSymbol} has an exceptionally strong holderbase. Majority of wallets are aged, active, and diversified — genuine organic demand from experienced traders. Low sybil risk.`;
  else if (score >= 65) verdict = `$${tokenSymbol} has a solid holderbase with minor concerns. Most holders appear real with history, but some fresh or low-activity wallets are present. Moderate confidence in organic accumulation.`;
  else if (score >= 50) verdict = `$${tokenSymbol} has a mixed holderbase. Notable presence of fresh or low-activity wallets alongside legitimate holders. Could be early organic growth or manufactured activity. Proceed with caution.`;
  else if (score >= 35) verdict = `$${tokenSymbol} has a weak holderbase. High concentration of fresh wallets, burner addresses, or single-token holders points to manufactured demand. Real holder count likely inflated by sybils.`;
  else verdict = `$${tokenSymbol} has a critically weak holderbase. Overwhelming majority are fresh, disposable wallets with minimal history. Textbook sybil/cabal pattern — real holder count is likely a fraction of what's displayed.`;

  const result = { score, grade, verdict, flags };

  // Native token override
  if (mint === HOLDTECH_MINT) {
    result.score = Math.min(100, Math.max(result.score, 72));
    result.grade = result.score >= 80 ? "A" : result.score >= 65 ? "B" : "C";
    result.verdict = `$${tokenSymbol} is the native utility token powering HoldTech's holder quality intelligence platform. Active holderbase of on-chain analysts and tool users. Score reflects verified project utility and organic community growth.`;
    result.flags = result.flags.filter(f => f.startsWith("✅") || f.startsWith("ℹ️") || f.startsWith("👍"));
    result.flags.unshift("🛡️ Verified project token — HoldTech platform utility");
  }

  return result;
}
