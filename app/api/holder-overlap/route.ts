import { NextRequest, NextResponse } from "next/server";

export const runtime = "edge";

const HELIUS_API_KEY = process.env.HELIUS_API_KEY || "2e5afdba-52c8-47bb-a203-d7571a17ade5";
const HELIUS_RPC = `https://mainnet.helius-rpc.com/?api-key=${HELIUS_API_KEY}`;

async function heliusRpc(method: string, params: unknown) {
  const res = await fetch(HELIUS_RPC, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
    signal: AbortSignal.timeout(15000),
  });
  const data = await res.json();
  return data.result;
}

interface HolderInfo {
  wallet: string;
  amount: number;
}

async function getHolders(mint: string, limit = 5000): Promise<HolderInfo[]> {
  const holders: HolderInfo[] = [];
  let cursor: string | undefined;

  // Page through token accounts — full holder base
  while (holders.length < limit) {
    const params: any = {
      mint,
      limit: 1000,
    };
    if (cursor) params.cursor = cursor;

    const result = await heliusRpc("getTokenAccounts", params);
    if (!result?.token_accounts || result.token_accounts.length === 0) break;

    for (const acc of result.token_accounts) {
      if (acc.owner && acc.amount) {
        holders.push({
          wallet: acc.owner,
          amount: Number(acc.amount),
        });
      }
    }

    cursor = result.cursor;
    if (!cursor) break;
  }

  return holders;
}

async function getTokenMeta(mint: string): Promise<{ name: string; symbol: string; image: string | null }> {
  try {
    const res = await fetch(`https://frontend-api-v3.pump.fun/coins/${mint}`, {
      signal: AbortSignal.timeout(4000),
    });
    if (res.ok) {
      const text = await res.text();
      if (text) {
        const coin = JSON.parse(text);
        if (coin.name) return { name: coin.name, symbol: coin.symbol || "???", image: coin.image_uri || null };
      }
    }
  } catch {}

  // DAS fallback
  try {
    const asset = await heliusRpc("getAsset", { id: mint });
    if (asset?.content?.metadata) {
      const meta = asset.content.metadata;
      return {
        name: meta.name || "Unknown",
        symbol: meta.symbol || "???",
        image: asset.content?.links?.image || asset.content?.files?.[0]?.uri || null,
      };
    }
  } catch {}

  return { name: "Unknown", symbol: "???", image: null };
}

export async function POST(req: NextRequest) {
  try {
    const { mints } = await req.json();
    if (!Array.isArray(mints) || mints.length < 2 || mints.length > 5) {
      return NextResponse.json({ error: "Provide 2-5 token mints" }, { status: 400 });
    }

    // Fetch holders + metadata for all tokens in parallel
    const [holderSets, metas] = await Promise.all([
      Promise.all(mints.map((m: string) => getHolders(m, 200))),
      Promise.all(mints.map((m: string) => getTokenMeta(m))),
    ]);

    // Build wallet sets per token
    const walletSets = holderSets.map(holders => new Set(holders.map(h => h.wallet)));
    const walletMaps = holderSets.map(holders => {
      const map = new Map<string, number>();
      for (const h of holders) map.set(h.wallet, h.amount);
      return map;
    });

    // Calculate pairwise overlaps
    const pairs: Array<{
      tokenA: { mint: string; name: string; symbol: string; image: string | null; holderCount: number };
      tokenB: { mint: string; name: string; symbol: string; image: string | null; holderCount: number };
      sharedWallets: number;
      overlapPctA: number; // % of A's holders also in B
      overlapPctB: number; // % of B's holders also in A
      overlapScore: number; // geometric mean
      wallets: Array<{ wallet: string; amountA: number; amountB: number }>;
    }> = [];

    for (let i = 0; i < mints.length; i++) {
      for (let j = i + 1; j < mints.length; j++) {
        const setA = walletSets[i];
        const setB = walletSets[j];
        const mapA = walletMaps[i];
        const mapB = walletMaps[j];

        // Find shared wallets
        const shared: Array<{ wallet: string; amountA: number; amountB: number }> = [];
        for (const wallet of setA) {
          if (setB.has(wallet)) {
            shared.push({
              wallet,
              amountA: mapA.get(wallet) || 0,
              amountB: mapB.get(wallet) || 0,
            });
          }
        }

        // Sort by combined holdings descending
        shared.sort((a, b) => (b.amountA + b.amountB) - (a.amountA + a.amountB));

        const overlapPctA = setA.size > 0 ? Math.round((shared.length / setA.size) * 100) : 0;
        const overlapPctB = setB.size > 0 ? Math.round((shared.length / setB.size) * 100) : 0;
        const overlapScore = Math.round(Math.sqrt(overlapPctA * overlapPctB));

        pairs.push({
          tokenA: { mint: mints[i], ...metas[i], holderCount: setA.size },
          tokenB: { mint: mints[j], ...metas[j], holderCount: setB.size },
          sharedWallets: shared.length,
          overlapPctA,
          overlapPctB,
          overlapScore,
          wallets: shared.slice(0, 50), // Top 50 shared wallets
        });
      }
    }

    // Sort pairs by overlap score descending
    pairs.sort((a, b) => b.overlapScore - a.overlapScore);

    // Coordination assessment
    const maxOverlap = pairs.length > 0 ? pairs[0].overlapScore : 0;
    let coordination: "NONE" | "LOW" | "MODERATE" | "HIGH" | "CRITICAL" = "NONE";
    if (maxOverlap >= 60) coordination = "CRITICAL";
    else if (maxOverlap >= 40) coordination = "HIGH";
    else if (maxOverlap >= 20) coordination = "MODERATE";
    else if (maxOverlap >= 5) coordination = "LOW";

    return NextResponse.json({
      pairs,
      coordination,
      maxOverlap,
      tokensAnalyzed: mints.length,
    });

  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Holder overlap failed" },
      { status: 500 }
    );
  }
}
