import { NextRequest, NextResponse } from "next/server";

export const runtime = "edge";

const HELIUS_API_KEY = process.env.HELIUS_API_KEY || "2e5afdba-52c8-47bb-a203-d7571a17ade5";
const HELIUS_RPC = `https://mainnet.helius-rpc.com/?api-key=${HELIUS_API_KEY}`;

async function heliusRpc(method: string, params: unknown[]) {
  const res = await fetch(HELIUS_RPC, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
    signal: AbortSignal.timeout(10000),
  });
  const data = await res.json();
  return data.result;
}

async function getDeployerFromMint(mint: string): Promise<string | null> {
  // Try pump.fun API first (most tokens are pump.fun)
  try {
    const pumpRes = await fetch(`https://frontend-api-v3.pump.fun/coins/${mint}`, {
      signal: AbortSignal.timeout(5000),
    });
    if (pumpRes.ok) {
      const text = await pumpRes.text();
      if (text) {
        const pumpData = JSON.parse(text);
        if (pumpData.creator) return pumpData.creator;
      }
    }
  } catch {}

  // Fallback: find the signer of the earliest transaction
  // For pump.fun v2, the fee payer is the mint itself, so we need to find
  // the actual signer (the user who created it)
  try {
    // Get first page of sigs, then page to the oldest
    let sigs = await heliusRpc("getSignaturesForAddress", [mint, { limit: 1000 }]);
    if (!sigs || sigs.length === 0) return null;

    // Only page up to 3 times to avoid timeout
    let pages = 0;
    while (sigs.length === 1000 && pages < 3) {
      const older = await heliusRpc("getSignaturesForAddress", [mint, { limit: 1000, before: sigs[sigs.length - 1].signature }]);
      if (!older || older.length === 0) break;
      sigs = older;
      pages++;
    }

    const oldest = sigs[sigs.length - 1];
    const tx = await heliusRpc("getTransaction", [oldest.signature, { encoding: "jsonParsed", maxSupportedTransactionVersion: 0 }]);
    if (!tx) return null;
    
    const keys = tx.transaction?.message?.accountKeys;
    if (Array.isArray(keys)) {
      // Find the first signer that isn't the mint itself
      const signers = keys.filter((k: any) => {
        const pubkey = typeof k === "string" ? k : k?.pubkey;
        const isSigner = typeof k === "string" ? true : k?.signer;
        return isSigner && pubkey !== mint;
      });
      if (signers.length > 0) {
        const s = signers[0];
        return typeof s === "string" ? s : s?.pubkey || null;
      }
      // Fallback to first key
      const first = keys[0];
      return typeof first === "string" ? first : first?.pubkey || null;
    }
    return null;
  } catch {
    return null;
  }
}

async function getDeployedTokens(deployer: string): Promise<Array<{
  mint: string;
  name: string;
  symbol: string;
  deployedAt: number | null;
  image: string | null;
}>> {
  const tokens: Array<{ mint: string; name: string; symbol: string; deployedAt: number | null; image: string | null }> = [];
  const seenMints = new Set<string>();
  const PUMP_PROGRAM = "6EF8rrecthR5Dkzon8Nwu78hRvfCKubJ14M5uBEwF6P";

  // Scan deployer's transaction history for pump.fun interactions
  // Get all signatures (up to 3 pages)
  let allSigs: any[] = [];
  try {
    let sigs = await heliusRpc("getSignaturesForAddress", [deployer, { limit: 1000 }]);
    if (sigs) allSigs = sigs;
    if (sigs && sigs.length === 1000) {
      const more = await heliusRpc("getSignaturesForAddress", [deployer, { limit: 1000, before: sigs[sigs.length - 1].signature }]);
      if (more) allSigs = allSigs.concat(more);
    }
  } catch {}

  // Parse transactions to find pump.fun mints where this wallet is fee payer
  // Process in batches of 10
  const candidateMints: Map<string, number | null> = new Map();
  
  for (let i = 0; i < Math.min(allSigs.length, 500); i += 10) {
    const batch = allSigs.slice(i, i + 10);
    const results = await Promise.allSettled(
      batch.map((sig: any) =>
        heliusRpc("getTransaction", [sig.signature, { encoding: "jsonParsed", maxSupportedTransactionVersion: 0 }])
          .then(tx => ({ tx, timestamp: sig.blockTime }))
      )
    );

    for (const r of results) {
      if (r.status !== "fulfilled" || !r.value?.tx) continue;
      const { tx, timestamp } = r.value;
      const ixs = tx.transaction?.message?.instructions || [];
      
      for (const ix of ixs) {
        if (ix.programId !== PUMP_PROGRAM) continue;
        const accounts: string[] = ix.accounts || [];
        // In pump.fun create tx, the fee payer (deployer) is account[0] in the outer tx
        // and the mint is one of the accounts that ends with "pump"
        for (const acc of accounts) {
          if (acc.endsWith("pump") && !seenMints.has(acc) && acc !== deployer) {
            seenMints.add(acc);
            candidateMints.set(acc, timestamp ? timestamp * 1000 : null);
          }
        }
      }
    }
  }

  // Now verify which mints were CREATED by this deployer (not just traded)
  // Check pump.fun coin API for each — creator field must match
  const mintEntries = Array.from(candidateMints.entries());
  
  for (let i = 0; i < mintEntries.length; i += 5) {
    const batch = mintEntries.slice(i, i + 5);
    const results = await Promise.allSettled(
      batch.map(async ([mint, ts]) => {
        try {
          const res = await fetch(`https://frontend-api-v3.pump.fun/coins/${mint}`, {
            signal: AbortSignal.timeout(4000),
          });
          if (!res.ok) return { mint, ts, coin: null };
          const text = await res.text();
          return { mint, ts, coin: text ? JSON.parse(text) : null };
        } catch {
          return { mint, ts, coin: null };
        }
      })
    );

    for (const r of results) {
      if (r.status !== "fulfilled" || !r.value) continue;
      const { mint, ts, coin } = r.value;
      if (coin && coin.creator === deployer) {
        tokens.push({
          mint,
          name: coin.name || "Unknown",
          symbol: coin.symbol || "???",
          deployedAt: coin.created_timestamp ? new Date(coin.created_timestamp).getTime() : ts,
          image: coin.image_uri || null,
        });
      }
    }
  }

  return tokens;
}

async function checkTokenStatus(mint: string): Promise<{
  alive: boolean;
  holderCount: number;
  liquidity: number | null;
}> {
  try {
    // Quick check via DexScreener
    const res = await fetch(`https://api.dexscreener.com/latest/dex/tokens/${mint}`, {
      signal: AbortSignal.timeout(5000),
    });
    if (res.ok) {
      const data = await res.json();
      const pair = data.pairs?.[0];
      if (pair) {
        return {
          alive: parseFloat(pair.liquidity?.usd || "0") > 100,
          holderCount: 0, // DexScreener doesn't give holder count
          liquidity: parseFloat(pair.liquidity?.usd || "0"),
        };
      }
    }
    return { alive: false, holderCount: 0, liquidity: null };
  } catch {
    return { alive: false, holderCount: 0, liquidity: null };
  }
}

export async function POST(req: NextRequest) {
  try {
    const { mint } = await req.json();
    if (!mint) return NextResponse.json({ error: "Missing mint" }, { status: 400 });

    // Step 1: Find the deployer
    // First try to get deployer from token mint, if that fails treat input as deployer wallet
    let deployer = await getDeployerFromMint(mint);
    if (!deployer) {
      // Maybe the input IS the deployer wallet
      deployer = mint;
    }

    // Step 2: Get all tokens they've deployed
    const deployedTokens = await getDeployedTokens(deployer);

    // Step 3: Check status of each (limited to first 20 to avoid rate limits)
    const tokenStatuses = await Promise.all(
      deployedTokens.slice(0, 20).map(async (token) => {
        const status = await checkTokenStatus(token.mint);
        return { ...token, ...status };
      })
    );

    // Sort by deploy time (newest first)
    tokenStatuses.sort((a, b) => (b.deployedAt || 0) - (a.deployedAt || 0));

    // Calculate stats
    const total = tokenStatuses.length;
    const alive = tokenStatuses.filter(t => t.alive).length;
    const dead = total - alive;
    const rugRate = total > 0 ? Math.round((dead / total) * 100) : 0;

    // Average lifespan for dead tokens (rough estimate from deploy timestamps)
    let avgLifespanHours: number | null = null;
    const deadWithTime = tokenStatuses.filter(t => !t.alive && t.deployedAt);
    if (deadWithTime.length > 0) {
      // For dead tokens, estimate lifespan as time from deploy to now (rough)
      // In reality we'd check when liquidity was pulled, but this is a beta approximation
      avgLifespanHours = null; // TODO: need historical data for accurate lifespan
    }

    return NextResponse.json({
      deployer,
      totalLaunches: total,
      alive,
      dead,
      rugRate,
      avgLifespanHours,
      tokens: tokenStatuses,
      currentToken: mint,
    });

  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Deployer profile failed" },
      { status: 500 }
    );
  }
}
