import { NextRequest, NextResponse } from "next/server";
import { cached } from "@/app/lib/cache";

const HELIUS_API_KEY = process.env.HELIUS_API_KEY || "2e5afdba-52c8-47bb-a203-d7571a17ade5";
const HELIUS_RPC = `https://mainnet.helius-rpc.com/?api-key=${HELIUS_API_KEY}`;

async function fetchPage(mint: string, page: number): Promise<number> {
  const res = await fetch(HELIUS_RPC, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      jsonrpc: "2.0", id: `hc-${page}`,
      method: "getTokenAccounts",
      params: { mint, limit: 1000, page, options: { showZeroBalance: false } },
    }),
    signal: AbortSignal.timeout(8000),
  });
  const data = await res.json();
  return data.result?.token_accounts?.length || 0;
}

export async function POST(req: NextRequest) {
  try {
    const { mint } = await req.json();
    if (!mint) return NextResponse.json({ error: "Missing mint" }, { status: 400 });

    // Cache holder count for 5 min — doesn't change fast, saves ~8 Helius calls per scan
    const holderCount = await cached(`hc:${mint}`, 300, async () => {
      const p1 = await fetchPage(mint, 1);
      if (p1 < 1000) return p1;

      let lo = 2, hi = 200;
      while (lo < hi) {
        const mid = Math.floor((lo + hi) / 2);
        const count = await fetchPage(mint, mid);
        if (count === 1000) lo = mid + 1;
        else hi = mid;
      }
      const lastCount = await fetchPage(mint, lo);
      return (lo - 1) * 1000 + lastCount;
    });

    return NextResponse.json({ holderCount });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Failed" }, { status: 500 });
  }
}
