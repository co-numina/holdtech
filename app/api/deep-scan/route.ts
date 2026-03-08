import { NextRequest, NextResponse } from "next/server";

const HELIUS_API_KEY = "2e5afdba-52c8-47bb-a203-d7571a17ade5";
const HELIUS_RPC = `https://mainnet.helius-rpc.com/?api-key=${HELIUS_API_KEY}`;
const HELIUS_API = `https://api.helius.xyz/v0`;

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

// Use Helius enhanced transaction API — parsed, labeled, 1 call = 100 txs
async function getEnhancedTransactions(address: string, before?: string): Promise<unknown[]> {
  const url = new URL(`${HELIUS_API}/addresses/${address}/transactions`);
  url.searchParams.set("api-key", HELIUS_API_KEY);
  url.searchParams.set("limit", "100");
  if (before) url.searchParams.set("before", before);

  const res = await fetch(url.toString());
  if (!res.ok) return [];
  return await res.json();
}

// Get parsed transaction history for a token mint — finds all swap/transfer events
async function getTokenTransactionHistory(mint: string, pages: number = 3): Promise<unknown[]> {
  const allTxs: unknown[] = [];
  let before: string | undefined;

  for (let i = 0; i < pages; i++) {
    const txs = await getEnhancedTransactions(mint, before);
    if (!txs || txs.length === 0) break;
    allTxs.push(...txs);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    before = (txs[txs.length - 1] as any).signature;
    if (txs.length < 100) break;
    await new Promise((r) => setTimeout(r, 200));
  }

  return allTxs;
}

interface BundleGroup {
  slot: number;
  timestamp: number;
  wallets: string[];
  txCount: number;
}

interface FundingSource {
  wallet: string;
  fundedBy: string | null;
  fundingTxSig: string | null;
  fundingAmount: number;
}

interface ConcentrationData {
  top5Pct: number;
  top10Pct: number;
  top20Pct: number;
  giniCoefficient: number;
  herfindahlIndex: number;
}

interface BuyEvent {
  wallet: string;
  timestamp: number;
  slot: number;
  signature: string;
  minutesAfterFirst: number;
}

interface SolBalanceDistribution {
  dust: number;      // < 0.1 SOL
  low: number;       // 0.1 - 1 SOL
  medium: number;    // 1 - 10 SOL
  high: number;      // 10 - 100 SOL
  whale: number;     // > 100 SOL
}

// 1. BUNDLE DETECTION — group token buy transactions by slot
function detectBundles(txs: unknown[]): BundleGroup[] {
  const slotMap = new Map<number, { wallets: Set<string>; timestamp: number; count: number }>();

  for (const tx of txs) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const t = tx as any;
    if (!t.slot || !t.timestamp) continue;

    // Look for SWAP or TRANSFER type events involving token buys
    const type = t.type;
    if (type !== "SWAP" && type !== "TRANSFER" && type !== "UNKNOWN") continue;

    // Extract the fee payer as the "buyer" wallet
    const wallet = t.feePayer;
    if (!wallet) continue;

    if (!slotMap.has(t.slot)) {
      slotMap.set(t.slot, { wallets: new Set(), timestamp: t.timestamp, count: 0 });
    }
    const entry = slotMap.get(t.slot)!;
    entry.wallets.add(wallet);
    entry.count++;
  }

  // Only return slots with 3+ unique wallets (potential bundles)
  const bundles: BundleGroup[] = [];
  for (const [slot, data] of slotMap) {
    if (data.wallets.size >= 3) {
      bundles.push({
        slot,
        timestamp: data.timestamp * 1000,
        wallets: Array.from(data.wallets),
        txCount: data.count,
      });
    }
  }

  return bundles.sort((a, b) => b.wallets.length - a.wallets.length);
}

// 2. FUNDING SOURCE — trace where each wallet's SOL came from (1-2 hops)
async function traceFundingSource(wallet: string): Promise<FundingSource> {
  try {
    // Get the wallet's earliest transactions to find who funded it
    const sigs = await heliusRpc("getSignaturesForAddress", [
      wallet,
      { limit: 20 },
    ]);

    if (!sigs || sigs.length === 0) {
      return { wallet, fundedBy: null, fundingTxSig: null, fundingAmount: 0 };
    }

    // Get the oldest transactions — look for incoming SOL transfers
    // Sort by blockTime ascending
    const sorted = [...sigs].sort(
      (a: { blockTime?: number }, b: { blockTime?: number }) =>
        (a.blockTime || 0) - (b.blockTime || 0)
    );

    // Check earliest transactions for SOL transfer in
    for (const sig of sorted.slice(0, 5)) {
      try {
        const tx = await heliusRpc("getTransaction", [
          sig.signature,
          { encoding: "jsonParsed", maxSupportedTransactionVersion: 0 },
        ]);

        if (!tx?.meta?.preBalances || !tx?.meta?.postBalances) continue;

        const accountKeys = tx.transaction?.message?.accountKeys || [];
        const walletIdx = accountKeys.findIndex(
          (k: { pubkey?: string } | string) =>
            (typeof k === "string" ? k : k.pubkey) === wallet
        );

        if (walletIdx === -1) continue;

        const preBalance = tx.meta.preBalances[walletIdx] || 0;
        const postBalance = tx.meta.postBalances[walletIdx] || 0;
        const diff = (postBalance - preBalance) / 1e9;

        // Found incoming SOL > 0.01
        if (diff > 0.01) {
          // The funder is the fee payer (index 0) if it's not the wallet itself
          const feePayerKey = accountKeys[0];
          const feePayer = typeof feePayerKey === "string" ? feePayerKey : feePayerKey?.pubkey;

          if (feePayer && feePayer !== wallet) {
            return {
              wallet,
              fundedBy: feePayer,
              fundingTxSig: sig.signature,
              fundingAmount: Math.round(diff * 1000) / 1000,
            };
          }
        }
      } catch {
        continue;
      }
    }

    return { wallet, fundedBy: null, fundingTxSig: null, fundingAmount: 0 };
  } catch {
    return { wallet, fundedBy: null, fundingTxSig: null, fundingAmount: 0 };
  }
}

// 3. CONCENTRATION — Gini coefficient + Herfindahl index
function computeConcentration(balances: number[], totalSupply: number): ConcentrationData {
  const sorted = [...balances].sort((a, b) => b - a);
  const n = sorted.length;

  const top5 = sorted.slice(0, 5).reduce((s, v) => s + v, 0);
  const top10 = sorted.slice(0, 10).reduce((s, v) => s + v, 0);
  const top20 = sorted.slice(0, 20).reduce((s, v) => s + v, 0);

  // Gini coefficient
  let giniNum = 0;
  const total = sorted.reduce((s, v) => s + v, 0);
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      giniNum += Math.abs(sorted[i] - sorted[j]);
    }
  }
  const gini = n > 1 && total > 0 ? giniNum / (2 * n * total) : 0;

  // Herfindahl-Hirschman Index (sum of squared market shares)
  const shares = sorted.map((b) => (totalSupply > 0 ? b / totalSupply : 0));
  const hhi = shares.reduce((s, share) => s + share * share, 0);

  return {
    top5Pct: totalSupply > 0 ? Math.round((top5 / totalSupply) * 1000) / 10 : 0,
    top10Pct: totalSupply > 0 ? Math.round((top10 / totalSupply) * 1000) / 10 : 0,
    top20Pct: totalSupply > 0 ? Math.round((top20 / totalSupply) * 1000) / 10 : 0,
    giniCoefficient: Math.round(gini * 1000) / 1000,
    herfindahlIndex: Math.round(hhi * 10000) / 10000,
  };
}

// 4. BUY TIMING — extract when each wallet first interacted with this token
function extractBuyTimeline(txs: unknown[], holderAddresses: Set<string>): BuyEvent[] {
  const firstBuy = new Map<string, BuyEvent>();
  let earliestTimestamp = Infinity;

  for (const tx of txs) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const t = tx as any;
    if (!t.timestamp || !t.feePayer) continue;

    const wallet = t.feePayer;
    if (!holderAddresses.has(wallet)) continue;

    const ts = t.timestamp * 1000;
    if (ts < earliestTimestamp) earliestTimestamp = ts;

    if (!firstBuy.has(wallet) || ts < firstBuy.get(wallet)!.timestamp) {
      firstBuy.set(wallet, {
        wallet,
        timestamp: ts,
        slot: t.slot || 0,
        signature: t.signature || "",
        minutesAfterFirst: 0,
      });
    }
  }

  const events = Array.from(firstBuy.values());
  events.forEach((e) => {
    e.minutesAfterFirst = Math.round((e.timestamp - earliestTimestamp) / 60000);
  });

  return events.sort((a, b) => a.timestamp - b.timestamp);
}

// 5. SOL BALANCE DISTRIBUTION
function computeSolDistribution(wallets: { solBalance: number; isPool?: boolean }[]): SolBalanceDistribution {
  const human = wallets.filter((w) => !w.isPool);
  const n = human.length || 1;
  return {
    dust: Math.round((human.filter((w) => w.solBalance < 0.1).length / n) * 1000) / 10,
    low: Math.round((human.filter((w) => w.solBalance >= 0.1 && w.solBalance < 1).length / n) * 1000) / 10,
    medium: Math.round((human.filter((w) => w.solBalance >= 1 && w.solBalance < 10).length / n) * 1000) / 10,
    high: Math.round((human.filter((w) => w.solBalance >= 10 && w.solBalance < 100).length / n) * 1000) / 10,
    whale: Math.round((human.filter((w) => w.solBalance >= 100).length / n) * 1000) / 10,
  };
}

export async function POST(req: NextRequest) {
  try {
    const { mint, wallets, totalSupply } = await req.json();

    if (!mint) {
      return NextResponse.json({ error: "Missing mint" }, { status: 400 });
    }

    const results: Record<string, unknown> = {};

    // 1. Get token transaction history (3 pages × 100 = 300 txs)
    // This gives us bundle detection + buy timing
    const txHistory = await getTokenTransactionHistory(mint, 3);
    results.txHistoryCount = txHistory.length;

    // 2. Bundle detection — split into active (still holding) vs historical (sold)
    const allBundles = detectBundles(txHistory);
    const currentHolderSet = wallets && wallets.length > 0
      ? new Set<string>(wallets.map((w: { address: string }) => w.address))
      : new Set<string>();

    const activeBundles: BundleGroup[] = [];
    const historicalBundles: BundleGroup[] = [];

    for (const bundle of allBundles) {
      const activeWallets = bundle.wallets.filter((w) => currentHolderSet.has(w));
      const historicalWallets = bundle.wallets.filter((w) => !currentHolderSet.has(w));

      if (activeWallets.length >= 2) {
        activeBundles.push({ ...bundle, wallets: activeWallets, txCount: bundle.txCount });
      }
      if (historicalWallets.length > 0) {
        historicalBundles.push({ ...bundle, wallets: historicalWallets, txCount: bundle.txCount });
      }
    }

    results.bundles = activeBundles.slice(0, 10);
    results.bundleCount = activeBundles.length;
    results.bundledWalletCount = new Set(activeBundles.flatMap((b) => b.wallets)).size;
    results.historicalBundles = historicalBundles.slice(0, 10);
    results.historicalBundleCount = historicalBundles.length;
    results.historicalBundledWalletCount = new Set(historicalBundles.flatMap((b) => b.wallets)).size;
    // Legacy totals for backward compat
    results.totalBundleCount = allBundles.length;
    results.totalBundledWalletCount = new Set(allBundles.flatMap((b) => b.wallets)).size;

    // 3. Buy timeline
    if (wallets && wallets.length > 0) {
      const holderSet = new Set<string>(wallets.map((w: { address: string }) => w.address));
      results.buyTimeline = extractBuyTimeline(txHistory, holderSet);
    }

    // 4. Concentration (exclude pool from both balances AND supply denominator)
    if (wallets && wallets.length > 0 && totalSupply) {
      const nonPoolWallets = wallets.filter((w: { isPool?: boolean }) => !w.isPool);
      const balances = nonPoolWallets.map((w: { balance: number }) => w.balance);
      const poolBalance = wallets
        .filter((w: { isPool?: boolean }) => w.isPool)
        .reduce((s: number, w: { balance: number }) => s + w.balance, 0);
      const circulatingSupply = totalSupply - poolBalance;
      results.concentration = computeConcentration(balances, circulatingSupply > 0 ? circulatingSupply : totalSupply);
    }

    // 5. SOL balance distribution
    if (wallets && wallets.length > 0) {
      results.solDistribution = computeSolDistribution(wallets);
    }

    // 6. Funding source tracing (top 10 non-pool wallets, sequential with delays)
    if (wallets && wallets.length > 0) {
      const nonPoolWallets = wallets
        .filter((w: { isPool?: boolean }) => !w.isPool)
        .slice(0, 10);

      const fundingSources: FundingSource[] = [];
      for (const w of nonPoolWallets) {
        const source = await traceFundingSource(w.address);
        fundingSources.push(source);
        await new Promise((r) => setTimeout(r, 300));
      }

      results.fundingSources = fundingSources;

      // Cluster analysis — group wallets by common funding source
      const funderMap = new Map<string, string[]>();
      for (const fs of fundingSources) {
        if (fs.fundedBy) {
          if (!funderMap.has(fs.fundedBy)) funderMap.set(fs.fundedBy, []);
          funderMap.get(fs.fundedBy)!.push(fs.wallet);
        }
      }

      const clusters = Array.from(funderMap.entries())
        .filter(([, walletList]) => walletList.length >= 2)
        .map(([funder, walletList]) => ({
          funder,
          wallets: walletList,
          count: walletList.length,
        }))
        .sort((a, b) => b.count - a.count);

      results.fundingClusters = clusters;
      results.clusterCount = clusters.length;
      results.clusteredWalletCount = clusters.reduce((s, c) => s + c.count, 0);
    }

    return NextResponse.json(results);
  } catch (err) {
    console.error("Deep scan error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Deep scan failed" },
      { status: 500 }
    );
  }
}
