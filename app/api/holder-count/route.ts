import { NextRequest, NextResponse } from "next/server";

const HELIUS_API_KEY = "2e5afdba-52c8-47bb-a203-d7571a17ade5";
const HELIUS_RPC = `https://mainnet.helius-rpc.com/?api-key=${HELIUS_API_KEY}`;

// Strategy 1: Rugcheck (instant, works for most pump.fun tokens)
async function rugcheckHolderCount(mint: string): Promise<number | null> {
  try {
    const res = await fetch(`https://api.rugcheck.xyz/v1/tokens/${mint}/report`, {
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) return null;
    const data = await res.json();
    const count = data?.totalHolders;
    return count && count > 0 ? count : null;
  } catch { return null; }
}

// Strategy 2: Helius binary search (fallback, works for all tokens)
async function heliusBinaryCount(mint: string): Promise<number> {
  const fetchPage = async (page: number): Promise<number> => {
    const res = await fetch(HELIUS_RPC, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ jsonrpc: "2.0", id: `hc-${page}`, method: "getTokenAccounts", params: { mint, limit: 1000, page } }),
      signal: AbortSignal.timeout(8000),
    });
    const data = await res.json();
    return data.result?.token_accounts?.length || 0;
  };

  const p1 = await fetchPage(1);
  if (p1 < 1000) return p1;

  // Binary search for last page
  let lo = 2, hi = 200;
  while (lo < hi) {
    const mid = Math.floor((lo + hi) / 2);
    const count = await fetchPage(mid);
    if (count === 1000) lo = mid + 1;
    else hi = mid;
  }
  const lastPageCount = await fetchPage(lo);
  return (lo - 1) * 1000 + lastPageCount;
}

export async function POST(req: NextRequest) {
  try {
    const { mint } = await req.json();
    if (!mint) return NextResponse.json({ error: "Missing mint" }, { status: 400 });

    // Try Rugcheck first (instant)
    const rugcheck = await rugcheckHolderCount(mint);
    if (rugcheck) return NextResponse.json({ holderCount: rugcheck, source: "rugcheck" });

    // Fallback to Helius binary search
    const helius = await heliusBinaryCount(mint);
    return NextResponse.json({ holderCount: helius, source: "helius" });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Failed" }, { status: 500 });
  }
}
