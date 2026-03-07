import { NextRequest, NextResponse } from "next/server";

const HELIUS_API_KEY = "2e5afdba-52c8-47bb-a203-d7571a17ade5";
const HELIUS_RPC = `https://mainnet.helius-rpc.com/?api-key=${HELIUS_API_KEY}`;
const MORALIS_API_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJub25jZSI6IjBkZmFkYmY0LWZhNjItNDUxMy1hMDI1LWZhOWE4NzQ2YjllYiIsIm9yZ0lkIjoiNTA0MzIxIiwidXNlcklkIjoiNTE4OTI2IiwidHlwZUlkIjoiNGEzZjY2NzgtZWJiZC00MGIzLTg4MTEtOTY1ZjIxMjhhMjhmIiwidHlwZSI6IlBST0pFQ1QiLCJpYXQiOjE3NzI4NzU5NzcsImV4cCI6NDkyODYzNTk3N30.xrm3tIN8V_I4pRDf-TVG2mQjqDjeT4Wn9gXu16JvgQw";

// Binary search for total pages — way faster than sequential
async function countHoldersFast(mint: string): Promise<number> {
  const fetchPage = async (page: number): Promise<number> => {
    const res = await fetch(HELIUS_RPC, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ jsonrpc: "2.0", id: `hc-${page}`, method: "getTokenAccounts", params: { mint, limit: 1000, page } }),
    });
    const data = await res.json();
    return data.result?.token_accounts?.length || 0;
  };

  // Page 1
  const p1 = await fetchPage(1);
  if (p1 < 1000) return p1;

  // Binary search for last full page
  let lo = 2, hi = 200;
  while (lo < hi) {
    const mid = Math.floor((lo + hi) / 2);
    const count = await fetchPage(mid);
    if (count === 1000) lo = mid + 1;
    else hi = mid;
  }

  // lo is now the first page with < 1000 results
  const lastPageCount = await fetchPage(lo);
  return (lo - 1) * 1000 + lastPageCount;
}

export async function POST(req: NextRequest) {
  try {
    const { mint } = await req.json();
    if (!mint) return NextResponse.json({ error: "Missing mint" }, { status: 400 });

    const total = await countHoldersFast(mint);
    return NextResponse.json({ holderCount: total });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Failed" }, { status: 500 });
  }
}
