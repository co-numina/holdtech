import { NextRequest, NextResponse } from "next/server";

const HELIUS_API_KEY = "2e5afdba-52c8-47bb-a203-d7571a17ade5";
const HELIUS_RPC = `https://mainnet.helius-rpc.com/?api-key=${HELIUS_API_KEY}`;

export async function POST(req: NextRequest) {
  try {
    const { mint } = await req.json();
    if (!mint) return NextResponse.json({ error: "Missing mint" }, { status: 400 });

    // Paginate getTokenAccounts to count all holders
    const p1Res = await fetch(HELIUS_RPC, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ jsonrpc: "2.0", id: "hc-1", method: "getTokenAccounts", params: { mint, limit: 1000, page: 1 } }),
    });
    const p1Data = await p1Res.json();
    const p1Accounts = p1Data.result?.token_accounts || [];
    let total = p1Accounts.length;

    if (p1Accounts.length === 1000) {
      let page = 2;
      let done = false;
      while (!done && page <= 100) {
        const batch = Array.from({ length: 5 }, (_, i) => page + i).filter(p => p <= 100);
        const results = await Promise.all(batch.map(p =>
          fetch(HELIUS_RPC, {
            method: "POST", headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ jsonrpc: "2.0", id: `hc-${p}`, method: "getTokenAccounts", params: { mint, limit: 1000, page: p } }),
          }).then(r => r.json()).then(d => d.result?.token_accounts?.length || 0).catch(() => 0)
        ));
        for (const count of results) {
          total += count;
          if (count < 1000) { done = true; break; }
        }
        page += 5;
      }
    }

    return NextResponse.json({ holderCount: total });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Failed" }, { status: 500 });
  }
}
