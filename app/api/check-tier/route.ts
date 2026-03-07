import { NextRequest, NextResponse } from "next/server";

const HELIUS_RPC = "https://mainnet.helius-rpc.com/?api-key=2e5afdba-52c8-47bb-a203-d7571a17ade5";
const HOLDTECH_MINT = "ENvMgAAzKRffbMpKWzNmZxmRTmNhjNFNazbEJjsJpump";
const DECIMALS = 6;

// Tier thresholds (raw token amounts)
const TIERS = [
  { name: "WHALE", min: 20_000_000 },
  { name: "OPERATOR", min: 10_000_000 },
  { name: "SCOUT", min: 3_000_000 },
  { name: "FREE", min: 0 },
];

export async function POST(req: NextRequest) {
  try {
    const { wallet } = await req.json();
    if (!wallet) return NextResponse.json({ error: "Missing wallet" }, { status: 400 });

    // Get all token accounts for this wallet filtered by HOLDTECH mint
    const res = await fetch(HELIUS_RPC, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        method: "getTokenAccountsByOwner",
        params: [
          wallet,
          { mint: HOLDTECH_MINT },
          { encoding: "jsonParsed" },
        ],
      }),
    });

    const data = await res.json();
    const accounts = data.result?.value || [];
    
    let balance = 0;
    for (const acc of accounts) {
      const info = acc.account?.data?.parsed?.info;
      if (info?.tokenAmount) {
        balance += parseFloat(info.tokenAmount.uiAmountString || "0");
      }
    }

    // Determine tier
    const tier = TIERS.find(t => balance >= t.min) || TIERS[TIERS.length - 1];

    return NextResponse.json({
      wallet,
      balance: Math.floor(balance),
      tier: tier.name,
      nextTier: TIERS[TIERS.indexOf(tier) - 1] || null,
      needed: TIERS[TIERS.indexOf(tier) - 1] ? Math.ceil(TIERS[TIERS.indexOf(tier) - 1].min - balance) : 0,
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Tier check failed" },
      { status: 500 }
    );
  }
}
