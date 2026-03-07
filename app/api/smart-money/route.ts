import { NextRequest, NextResponse } from "next/server";

export const runtime = "edge";

const HELIUS_API_KEY = process.env.HELIUS_API_KEY || "2e5afdba-52c8-47bb-a203-d7571a17ade5";
const HELIUS_RPC = `https://mainnet.helius-rpc.com/?api-key=${HELIUS_API_KEY}`;

const SMART_MONEY_WALLETS = [
  "GijFWw4oNyh9ko3FaZforNsi3jk6wDovARpkKahPD4o5",
  "catK9v3gp2dd32bkUxDEst4BarwDoCL3pkFfVoVjcgi",
  "VJSDW6S74YXR4rRR9P4xwhMvLZJQMhrUb8XMFirUsy1",
  "Af8Zu4DMx4KTtpwwKTE4yoYo4B5zoRhcBsxGYp5RN4bE",
  "HF2Lw2tYs4B3y1iqz6iw2f4wTjrn14KppvAezcm7TAT3",
  "HGcXS42jHV5HLSaNi9njkVAXpGUnyrQc2kQUGn6zMoDK",
  "FRa5xvWrvgYBHEukozdhJPCJRuJZcTn2WKj2u6L75Rmj",
  "97hp4A1DTSzd2YvCoDCQz6zzjnz74vrYnM1Hndxtyv6j",
  "2z2GGwmbx5bkRhPM8Bra9KxQDMks6L4ugPkuAEb7Y8fx",
  "7SePTjtFmM6JgBN3UVwg6ghvGrktP9cLb7h3kt3rzp48",
];

// Check if any smart money wallets hold a given token
export async function POST(req: NextRequest) {
  try {
    const { mint, holders } = await req.json();
    if (!mint) return NextResponse.json({ error: "Missing mint" }, { status: 400 });

    const smartMoneySet = new Set(SMART_MONEY_WALLETS);
    const found: Array<{ wallet: string; amount: number }> = [];

    // If we got holder list from the scan, check against it (fast path)
    if (holders && Array.isArray(holders)) {
      for (const h of holders) {
        const addr = h.address || h.wallet || h.owner;
        if (addr && smartMoneySet.has(addr)) {
          found.push({ wallet: addr, amount: h.balance || h.amount || 0 });
        }
      }
    }

    // If no holders provided or none found, check directly via RPC
    if (found.length === 0) {
      // Check each smart money wallet for token accounts of this mint
      const results = await Promise.allSettled(
        SMART_MONEY_WALLETS.map(async (wallet) => {
          const res = await fetch(HELIUS_RPC, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              jsonrpc: "2.0", id: 1,
              method: "getTokenAccountsByOwner",
              params: [wallet, { mint }, { encoding: "jsonParsed" }],
            }),
            signal: AbortSignal.timeout(5000),
          });
          const data = await res.json();
          const accounts = data.result?.value || [];
          if (accounts.length > 0) {
            const amount = accounts[0]?.account?.data?.parsed?.info?.tokenAmount?.uiAmount || 0;
            if (amount > 0) return { wallet, amount };
          }
          return null;
        })
      );

      for (const r of results) {
        if (r.status === "fulfilled" && r.value) {
          found.push(r.value);
        }
      }
    }

    return NextResponse.json({
      found: found.length,
      wallets: found,
      totalTracked: SMART_MONEY_WALLETS.length,
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Smart money check failed" },
      { status: 500 }
    );
  }
}
