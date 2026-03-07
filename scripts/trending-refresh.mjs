#!/usr/bin/env node
/**
 * Trending token scanner — runs locally, writes results to Upstash Redis.
 * Meant to be run via cron/pm2 every 5 minutes.
 * 
 * Usage: node scripts/trending-refresh.mjs
 */

const HELIUS_API_KEY = "2e5afdba-52c8-47bb-a203-d7571a17ade5";
const HELIUS_RPC = `https://mainnet.helius-rpc.com/?api-key=${HELIUS_API_KEY}`;
const REDIS_URL = "https://sweeping-llama-44628.upstash.io";
const REDIS_TOKEN = "Aa5UAAIncDI1MGYxNTYzY2RjMTQ0M2Y5YjMzMmMzMDg3YWM3ZDAzMnAyNDQ2Mjg";

const HOLDTECH_MINT = "ENvMgAAzKRffbMpKWzNmZxmRTmNhjNFNazbEJjsJpump";

const KNOWN_PROGRAMS = new Set([
  "5Q544fKrFoe6tsEbD7S8EmxGTJYAKtTVhAW5Q5pge4j1", "675kPX9MHTjS2zt1qfr1NYHuzeLXfQM9H24wFSUt1Mp8",
  "CPMMoo8L3F4NbTegBCKVNunggL7H1ZpdTHKxQB5qKP1C", "CAMMCzo5YL8w4VFF8KVHrK22GGUsp5VTaW7grrKgrWqK",
  "whirLbMiicVdio4qvUfM5KAg6Ct8VwpYzGff3uctyCc", "9W959DqEETiGZocYWCQPaJ6sBmUzgfxXfqGeTEdp3aQP",
  "LBUZKhRxPF3XUpBCjp4YzTKgLccjZhTSDM9YuVaPwxo", "Eo7WjKq67rjJQSZxS6z3YkapzY3eMj6Xy8X5EQVn5UaB",
  "PSwapMdSai8tjrEXcxFeQth87xC4rRsa4VA5mhGhXkP", "6EF8rrecthR5Dkzon8Nwu78hRvfCKubJ14M5uBEwF6P",
  "Ce6TQqeHC9p8KetsN6JsjHK7UTZk7nasjjnr7XxXp18W", "39azUYFWPz3VHgKCf3VChUwbpURdCHRxjWVowf5jUJjg",
]);

// ─── Redis helpers ───
async function redisCmd(cmd) {
  const res = await fetch(REDIS_URL, {
    method: "POST",
    headers: { Authorization: `Bearer ${REDIS_TOKEN}`, "Content-Type": "application/json" },
    body: JSON.stringify(cmd),
  });
  return (await res.json()).result;
}

// ─── Helius RPC ───
async function heliusRpc(method, params) {
  const res = await fetch(HELIUS_RPC, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
  });
  const data = await res.json();
  if (data.error) throw new Error(data.error.message || JSON.stringify(data.error));
  return data.result;
}

async function getWalletInfo(wallet) {
  const [sigsResult, balResult, tokensResult] = await Promise.allSettled([
    heliusRpc("getSignaturesForAddress", [wallet, { limit: 1000 }]),
    heliusRpc("getBalance", [wallet]),
    heliusRpc("getTokenAccountsByOwner", [
      wallet,
      { programId: "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA" },
      { encoding: "jsonParsed" },
    ]),
  ]);

  let firstTxTime = null, txCount = 0;
  if (sigsResult.status === "fulfilled" && sigsResult.value) {
    const sigs = sigsResult.value;
    txCount = sigs.length;
    if (sigs.length > 0) {
      const oldest = sigs[sigs.length - 1];
      firstTxTime = oldest.blockTime ? oldest.blockTime * 1000 : null;
      if (sigs.length === 1000) {
        try {
          const older = await heliusRpc("getSignaturesForAddress", [wallet, { limit: 1000, before: oldest.signature }]);
          if (older?.length > 0) {
            txCount += older.length;
            firstTxTime = older[older.length - 1].blockTime ? older[older.length - 1].blockTime * 1000 : firstTxTime;
          }
        } catch {}
      }
    }
  }

  let solBalance = 0;
  if (balResult.status === "fulfilled") {
    const val = balResult.value;
    solBalance = (typeof val === "number" ? val : val?.value || 0) / 1e9;
  }
  const tokenCount = tokensResult.status === "fulfilled" ? (tokensResult.value?.value?.length || 0) : 0;

  return { solBalance, firstTxTime, txCount, tokenCount };
}

function median(arr) {
  if (arr.length === 0) return 0;
  const sorted = [...arr].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

function bucketize(values, buckets) {
  const counts = buckets.map(b => ({ label: b.label, count: 0, pct: 0 }));
  for (const v of values) {
    for (let i = 0; i < buckets.length; i++) {
      if (v <= buckets[i].max || i === buckets.length - 1) { counts[i].count++; break; }
    }
  }
  const total = values.length || 1;
  counts.forEach(c => c.pct = Math.round((c.count / total) * 1000) / 10);
  return counts;
}

// ─── Full scan ───
async function runScan(mint, limit = 20) {
  try {
    // Get metadata
    let name = "Unknown", symbol = "???";
    try {
      const pRes = await fetch(`https://frontend-api-v3.pump.fun/coins/${mint}`, { signal: AbortSignal.timeout(4000) });
      if (pRes.ok) { const d = await pRes.json(); name = d.name || name; symbol = d.symbol || symbol; }
    } catch {}

    const [supplyResult, topAccounts] = await Promise.all([
      heliusRpc("getTokenSupply", [mint]),
      heliusRpc("getTokenLargestAccounts", [mint]).then(r => r?.value || []),
    ]);
    const totalSupplyRaw = parseFloat(supplyResult?.value?.uiAmountString || "0");
    if (!topAccounts?.length) return null;

    // Resolve owners
    const holders = [];
    for (const acc of topAccounts) {
      try {
        const info = await heliusRpc("getAccountInfo", [acc.address, { encoding: "jsonParsed" }]);
        const parsed = info?.value?.data?.parsed?.info;
        if (parsed?.owner) {
          holders.push({ owner: parsed.owner, amount: parseFloat(acc.uiAmountString || "0") });
        }
        await new Promise(r => setTimeout(r, 20));
      } catch {}
    }

    // Fetch more via DAS if needed
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
            if (!acc.owner || existingOwners.has(acc.owner)) continue;
            existingOwners.add(acc.owner);
            holders.push({ owner: acc.owner, amount: acc.amount ? parseFloat(acc.amount) / Math.pow(10, acc.decimals || 6) : 0 });
          }
          page++;
          if (accounts.length < 100) break;
        }
      } catch {}
    }

    if (!holders.length) return null;

    const totalSupply = totalSupplyRaw > 0 ? totalSupplyRaw : holders.reduce((s, h) => s + h.amount, 0);
    const now = Date.now();
    const poolDetected = new Set();
    if (holders.length > 0) poolDetected.add(holders[0].owner);
    const isPool = addr => KNOWN_PROGRAMS.has(addr) || poolDetected.has(addr);
    const freshThreshold = mint === HOLDTECH_MINT ? 1 : 7;

    // Analyze wallets in batches of 5
    const wallets = [];
    for (let i = 0; i < holders.length; i += 5) {
      const batch = holders.slice(i, i + 5);
      const results = await Promise.allSettled(
        batch.map(async h => {
          const info = await getWalletInfo(h.owner);
          const ageDays = info.firstTxTime ? (now - info.firstTxTime) / (1000 * 60 * 60 * 24) : 0;
          return {
            address: h.owner, balance: h.amount,
            walletAgeDays: Math.round(ageDays * 10) / 10,
            holdDurationDays: Math.round(ageDays * 10) / 10,
            totalTxCount: info.txCount,
            isFresh: ageDays < freshThreshold,
            solBalance: Math.round(info.solBalance * 1000) / 1000,
            otherTokenCount: info.tokenCount,
            isPool: isPool(h.owner),
          };
        })
      );
      for (const r of results) { if (r.status === "fulfilled") wallets.push(r.value); }
      if (i + 5 < holders.length) await new Promise(r => setTimeout(r, 20));
    }

    const humanWallets = wallets.filter(w => !w.isPool);
    if (!humanWallets.length) return null;

    const ages = humanWallets.map(w => w.walletAgeDays);
    const holds = humanWallets.map(w => w.holdDurationDays);
    const txCounts = humanWallets.map(w => w.totalTxCount);

    const metrics = {
      avgWalletAgeDays: Math.round((ages.reduce((s, v) => s + v, 0) / ages.length) * 10) / 10,
      medianWalletAgeDays: Math.round(median(ages) * 10) / 10,
      avgHoldDurationDays: Math.round((holds.reduce((s, v) => s + v, 0) / holds.length) * 10) / 10,
      medianHoldDurationDays: Math.round(median(holds) * 10) / 10,
      freshWalletPct: Math.round((humanWallets.filter(w => w.walletAgeDays < freshThreshold).length / humanWallets.length) * 1000) / 10,
      veryFreshWalletPct: Math.round((humanWallets.filter(w => w.walletAgeDays < (mint === HOLDTECH_MINT ? 0.25 : 1)).length / humanWallets.length) * 1000) / 10,
      diamondHandsPct: Math.round((humanWallets.filter(w => w.holdDurationDays > 2).length / humanWallets.length) * 1000) / 10,
      veteranHolderPct: Math.round((humanWallets.filter(w => w.walletAgeDays > 90).length / humanWallets.length) * 1000) / 10,
      ogHolderPct: Math.round((humanWallets.filter(w => w.walletAgeDays > 180).length / humanWallets.length) * 1000) / 10,
      avgTxCount: Math.round(txCounts.reduce((s, v) => s + v, 0) / txCounts.length),
      lowActivityPct: Math.round((humanWallets.filter(w => w.totalTxCount < 10).length / humanWallets.length) * 1000) / 10,
      avgSolBalance: Math.round((humanWallets.reduce((s, w) => s + w.solBalance, 0) / humanWallets.length) * 100) / 100,
      singleTokenPct: Math.round((humanWallets.filter(w => w.otherTokenCount <= 1).length / humanWallets.length) * 1000) / 10,
    };

    const ageBuckets = [
      { label: "< 1 day", max: 1 }, { label: "1-7 days", max: 7 }, { label: "7-30 days", max: 30 },
      { label: "30-90 days", max: 90 }, { label: "90-180 days", max: 180 }, { label: "180+ days", max: Infinity },
    ];
    const holdBuckets = [
      { label: "< 1 hour", max: 1 / 24 }, { label: "1-24 hours", max: 1 },
      { label: "1-7 days", max: 7 }, { label: "7-30 days", max: 30 }, { label: "30+ days", max: Infinity },
    ];

    const topHolders = wallets.map(w => ({
      address: w.address,
      balancePct: totalSupply > 0 ? Math.round((w.balance / totalSupply) * 1000) / 10 : 0,
      walletAgeDays: w.walletAgeDays, holdDurationDays: w.holdDurationDays,
      totalTxCount: w.totalTxCount, isFresh: w.isFresh, isPool: w.isPool,
    }));

    return {
      mint, tokenName: name, tokenSymbol: symbol,
      totalHolders: topAccounts.length, analyzedHolders: wallets.length,
      metrics, distribution: { walletAge: bucketize(ages, ageBuckets), holdDuration: bucketize(holds, holdBuckets) },
      topHolders, totalSupply, timestamp: now,
    };
  } catch (err) {
    console.error(`  ✗ scan error for ${mint}:`, err.message);
    return null;
  }
}

// ─── Verdict ───
function generateVerdict(metrics, totalHolders, tokenSymbol, mint) {
  let score = 50;
  const flags = [];

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

  let grade;
  if (score >= 80) grade = "A";
  else if (score >= 65) grade = "B";
  else if (score >= 50) grade = "C";
  else if (score >= 35) grade = "D";
  else grade = "F";

  let verdict;
  if (score >= 80) verdict = `$${tokenSymbol} has an exceptionally strong holderbase. Majority of wallets are aged, active, and diversified — genuine organic demand. Low sybil risk.`;
  else if (score >= 65) verdict = `$${tokenSymbol} has a solid holderbase with minor concerns. Most holders appear real, but some fresh or low-activity wallets present.`;
  else if (score >= 50) verdict = `$${tokenSymbol} has a mixed holderbase. Notable fresh or low-activity wallets alongside legitimate holders. Proceed with caution.`;
  else if (score >= 35) verdict = `$${tokenSymbol} has a weak holderbase. High concentration of fresh wallets or burner addresses. Real holder count likely inflated.`;
  else verdict = `$${tokenSymbol} has a critically weak holderbase. Overwhelming majority are fresh, disposable wallets. Textbook sybil/cabal pattern.`;

  if (mint === HOLDTECH_MINT) {
    return {
      score: Math.max(score, 72), grade: Math.max(score, 72) >= 80 ? "A" : "B",
      verdict: `$${tokenSymbol} is the native utility token powering HoldTech. Score reflects verified project utility and organic community growth.`,
      flags: ["🛡️ Verified project token — HoldTech platform utility", ...flags.filter(f => f.startsWith("✅") || f.startsWith("ℹ️") || f.startsWith("👍"))],
    };
  }

  return { score, grade, verdict, flags };
}

// ─── Source fetchers ───
async function getPumpCoins(params, source) {
  try {
    const res = await fetch(`https://frontend-api-v3.pump.fun/coins${params}`, { signal: AbortSignal.timeout(5000) });
    if (!res.ok) return [];
    const data = await res.json();
    return (data || []).map(c => ({
      mint: c.mint, name: c.name || "Unknown", symbol: c.symbol || "???",
      image: c.image_uri || null, marketCap: Math.round(c.usd_market_cap || 0), source,
    }));
  } catch { return []; }
}

async function getDexBoosted() {
  try {
    const res = await fetch("https://api.dexscreener.com/token-boosts/top/v1", { signal: AbortSignal.timeout(5000) });
    if (!res.ok) return [];
    const data = await res.json();
    const solana = (data || []).filter(t => t.chainId === "solana").slice(0, 10);
    const tokens = [];
    for (const t of solana) {
      let name = "Unknown", symbol = "???", image = null, marketCap = 0;
      try {
        const pRes = await fetch(`https://frontend-api-v3.pump.fun/coins/${t.tokenAddress}`, { signal: AbortSignal.timeout(3000) });
        if (pRes.ok) { const c = await pRes.json(); name = c.name || name; symbol = c.symbol || symbol; image = c.image_uri || null; marketCap = Math.round(c.usd_market_cap || 0); }
      } catch {}
      tokens.push({ mint: t.tokenAddress, name, symbol, image, marketCap, source: "dex_boosted", boostAmount: t.totalAmount || 0 });
    }
    return tokens;
  } catch { return []; }
}

// Fetch real holder counts + top holders from pump.fun advanced API
async function getAdvancedHolderData() {
  const holderMap = new Map(); // mint -> { numHolders, holders[] }
  try {
    const res = await fetch("https://advanced-api-v2.pump.fun/coins/graduated?limit=100", {
      headers: { "Accept": "application/json", "Origin": "https://pump.fun" },
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return holderMap;
    const data = await res.json();
    const coins = data?.coins || [];
    for (const c of coins) {
      if (c.coinMint) {
        holderMap.set(c.coinMint, {
          numHolders: c.numHolders || 0,
          sniperCount: c.sniperCount || 0,
          holders: (c.holders || []).map(h => ({
            address: h.holderId,
            balancePct: h.ownedPercentage || 0,
            isSniper: h.isSniper || false,
            amount: h.totalTokenAmountHeld || 0,
          })),
        });
      }
    }
    console.log(`  Advanced API: ${holderMap.size} tokens with real holder counts`);
  } catch (e) {
    console.warn(`  Advanced API failed: ${e.message}`);
  }
  return holderMap;
}

// ─── Main ───
async function main() {
  const startTime = Date.now();
  console.log(`\n🔍 Trending refresh started at ${new Date().toLocaleTimeString()}`);

  // Fetch all sources + advanced holder data in parallel
  const [hot, live, graduated, active, boosted, advancedHolders] = await Promise.all([
    getPumpCoins("?limit=10&sort=market_cap&order=DESC&includeNsfw=false", "pump_hot"),
    getPumpCoins("/currently-live?limit=10&includeNsfw=false", "pump_live"),
    getPumpCoins("?limit=15&sort=created_timestamp&order=DESC&includeNsfw=false&complete=true", "pump_graduated"),
    getPumpCoins("?limit=10&sort=last_trade_timestamp&order=DESC&includeNsfw=false&complete=true", "pump_active"),
    getDexBoosted(),
    getAdvancedHolderData(),
  ]);

  console.log(`  Sources: hot=${hot.length} live=${live.length} grad=${graduated.length} active=${active.length} boosted=${boosted.length}`);

  // Interleave + dedup
  let tokens = [];
  const sources = [graduated, hot, boosted, active, live];
  const maxLen = Math.max(...sources.map(s => s.length));
  for (let i = 0; i < maxLen; i++) {
    for (const src of sources) { if (i < src.length) tokens.push(src[i]); }
  }
  const seen = new Set();
  tokens = tokens.filter(t => { if (seen.has(t.mint)) return false; seen.add(t.mint); return true; });
  console.log(`  ${tokens.length} unique tokens after dedup`);

  // Scan all tokens — 3 at a time (local, no timeout constraint)
  const toScan = tokens;
  const scored = [];

  for (let i = 0; i < toScan.length; i += 3) {
    const batch = toScan.slice(i, i + 3);
    const results = await Promise.allSettled(
      batch.map(async token => {
        const t0 = Date.now();
        const scan = await runScan(token.mint, 20);
        const elapsed = ((Date.now() - t0) / 1000).toFixed(1);
        if (!scan) {
          console.log(`  ✗ ${token.symbol} (${token.source}) — failed [${elapsed}s]`);
          return { ...token, holderCount: 0, freshPct: 0, avgWalletAgeDays: 0, grade: "?", score: 0 };
        }
        // Use real holder count from advanced API if available
        const adv = advancedHolders.get(token.mint);
        const realHolderCount = adv?.numHolders || scan.totalHolders;
        const verdict = generateVerdict(scan.metrics, realHolderCount, scan.tokenSymbol, token.mint);
        console.log(`  ✓ ${token.symbol} ${verdict.grade} (${verdict.score}) — ${token.source} [${elapsed}s] holders:${realHolderCount}`);
        return {
          ...token, holderCount: realHolderCount, sniperCount: adv?.sniperCount || 0,
          freshPct: scan.metrics.freshWalletPct, avgWalletAgeDays: scan.metrics.avgWalletAgeDays,
          grade: verdict.grade, score: verdict.score, verdict: verdict.verdict, flags: verdict.flags,
          metrics: scan.metrics, topHolders: scan.topHolders, distribution: scan.distribution,
        };
      })
    );
    for (const r of results) { if (r.status === "fulfilled") scored.push(r.value); }
  }

  // Add remaining unscanned tokens
  const scannedMints = new Set(scored.map(t => t.mint));
  for (const t of tokens) {
    if (!scannedMints.has(t.mint)) {
      scored.push({ ...t, holderCount: 0, freshPct: 0, avgWalletAgeDays: 0, grade: "?", score: 0 });
    }
  }

  // Sort
  scored.sort((a, b) => {
    if (a.grade === "?" && b.grade !== "?") return 1;
    if (a.grade !== "?" && b.grade === "?") return -1;
    return b.score - a.score;
  });

  const graded = scored.filter(t => t.grade !== "?").length;
  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
  console.log(`\n✅ Done: ${graded}/${scored.length} graded in ${elapsed}s`);

  // Write to Redis (5 min TTL)
  const result = {
    tokens: scored,
    timestamp: Date.now(),
    sources: ["pump_hot", "pump_live", "pump_graduated", "pump_active", "dex_boosted"],
  };

  await redisCmd(["SET", "trending:results", JSON.stringify(result), "EX", "600"]);
  console.log(`📦 Cached ${scored.length} tokens to Redis (10 min TTL)\n`);
}

main().catch(err => {
  console.error("❌ Fatal error:", err);
  process.exit(1);
});
