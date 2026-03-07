import { NextRequest, NextResponse } from "next/server";

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
      const pumpData = await pumpRes.json();
      if (pumpData.creator) return pumpData.creator;
    }
  } catch {}

  // Fallback: get oldest transaction for this mint
  try {
    let sigs = await heliusRpc("getSignaturesForAddress", [mint, { limit: 1000 }]);
    if (!sigs || sigs.length === 0) return null;

    // Page through to find the very oldest
    while (sigs.length === 1000) {
      const older = await heliusRpc("getSignaturesForAddress", [mint, { limit: 1000, before: sigs[sigs.length - 1].signature }]);
      if (!older || older.length === 0) break;
      sigs = older;
    }

    const oldest = sigs[sigs.length - 1];
    const tx = await heliusRpc("getTransaction", [oldest.signature, { encoding: "jsonParsed", maxSupportedTransactionVersion: 0 }]);
    if (!tx) return null;
    
    const keys = tx.transaction?.message?.accountKeys;
    if (Array.isArray(keys)) {
      // Fee payer is the deployer
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

  // Primary: pump.fun created coins
  try {
    const pumpRes = await fetch(`https://frontend-api-v3.pump.fun/coins/user-created-coins/${deployer}?limit=50&offset=0&includeNsfw=true`, {
      signal: AbortSignal.timeout(10000),
    });
    if (pumpRes.ok) {
      const pumpData = await pumpRes.json();
      if (Array.isArray(pumpData)) {
        for (const coin of pumpData) {
          if (coin.mint && !seenMints.has(coin.mint)) {
            seenMints.add(coin.mint);
            tokens.push({
              mint: coin.mint,
              name: coin.name || "Unknown",
              symbol: coin.symbol || "???",
              deployedAt: coin.created_timestamp ? new Date(coin.created_timestamp).getTime() : null,
              image: coin.image_uri || null,
            });
          }
        }
      }
    }
  } catch {}

  // Fallback: Helius enhanced transaction history
  if (tokens.length === 0) {
    try {
      const res = await fetch(`https://api.helius.xyz/v0/addresses/${deployer}/transactions?api-key=${HELIUS_API_KEY}&limit=100`, {
        signal: AbortSignal.timeout(15000),
      });
      if (res.ok) {
        const txs = await res.json();
        for (const tx of txs) {
          if (tx.type === "CREATE" || tx.type === "TOKEN_MINT" || tx.description?.includes("create")) {
            const transfers = tx.tokenTransfers || [];
            for (const t of transfers) {
              if (t.mint && !seenMints.has(t.mint)) {
                seenMints.add(t.mint);
                tokens.push({
                  mint: t.mint,
                  name: tx.description?.match(/\$(\w+)/)?.[1] || "Unknown",
                  symbol: "???",
                  deployedAt: tx.timestamp ? tx.timestamp * 1000 : null,
                  image: null,
                });
              }
            }
          }
        }
      }
    } catch {}
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
    const deployer = await getDeployerFromMint(mint);
    if (!deployer) {
      return NextResponse.json({ error: "Could not identify deployer" }, { status: 404 });
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
