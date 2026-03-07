import { NextRequest, NextResponse } from "next/server";

export const runtime = "edge";

const HELIUS_API_KEY = process.env.HELIUS_API_KEY || "2e5afdba-52c8-47bb-a203-d7571a17ade5";

// Smart money wallets — curated list
const SMART_MONEY_WALLETS = new Set([
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
]);

interface Trade {
  mint: string;
  name: string;
  symbol: string;
  image: string | null;
  buyAmountSol: number;
  sellAmountSol: number;
  profitSol: number;
  profitPct: number;
  closed: boolean;
  timestamp: number;
}

async function getWalletPnL(wallet: string): Promise<{
  trades: Trade[];
  totalPnlSol: number;
  winRate: number;
  wins: number;
  losses: number;
  totalTrades: number;
  avgProfitPct: number;
  bestTrade: Trade | null;
  worstTrade: Trade | null;
  isSmartMoney: boolean;
}> {
  // Fetch all swap transactions from Helius enhanced API
  const allTxs: any[] = [];
  let before = "";
  let pages = 0;

  while (pages < 15) {
    try {
      const url = `https://api.helius.xyz/v0/addresses/${wallet}/transactions?api-key=${HELIUS_API_KEY}&limit=100&type=SWAP${before ? `&before=${before}` : ""}`;
      const res = await fetch(url, { signal: AbortSignal.timeout(8000) });
      if (!res.ok) break;
      const txs: any[] = await res.json();
      if (!txs || txs.length === 0) break;
      allTxs.push(...txs);
      before = txs[txs.length - 1].signature;
      if (txs.length < 100) break;
      pages++;
    } catch {
      break;
    }
  }

  // Group swaps by token mint
  // For each swap: check nativeTransfers and tokenTransfers to determine buy vs sell
  const tokenMap = new Map<string, { buySol: number; sellSol: number; lastTimestamp: number }>();

  for (const tx of allTxs) {
    if (tx.transactionError) continue;

    const transfers = tx.tokenTransfers || [];
    const nativeTransfers = tx.nativeTransfers || [];

    for (const tt of transfers) {
      if (!tt.mint || tt.mint === "So11111111111111111111111111111111111111112") continue;
      // Skip non-pump tokens (only care about pump.fun plays)
      if (!tt.mint.endsWith("pump")) continue;

      const amount = Math.abs(tt.tokenAmount || 0);
      if (amount === 0) continue;

      // Determine if buy or sell by checking SOL flow direction
      const solOut = nativeTransfers
        .filter((nt: any) => nt.fromUserAccount === wallet)
        .reduce((sum: number, nt: any) => sum + (nt.amount || 0), 0);
      const solIn = nativeTransfers
        .filter((nt: any) => nt.toUserAccount === wallet)
        .reduce((sum: number, nt: any) => sum + (nt.amount || 0), 0);

      const netSolLamports = solIn - solOut;
      const netSol = netSolLamports / 1e9;

      if (!tokenMap.has(tt.mint)) {
        tokenMap.set(tt.mint, { buySol: 0, sellSol: 0, lastTimestamp: tx.timestamp || 0 });
      }

      const entry = tokenMap.get(tt.mint)!;

      if (tt.toUserAccount === wallet || (tt.fromUserAccount !== wallet && amount > 0)) {
        // Buy — wallet received tokens, spent SOL
        entry.buySol += Math.abs(Math.min(netSol, 0));
      }
      if (tt.fromUserAccount === wallet) {
        // Sell — wallet sent tokens, received SOL
        entry.sellSol += Math.max(netSol, 0);
      }

      if ((tx.timestamp || 0) > entry.lastTimestamp) {
        entry.lastTimestamp = tx.timestamp || 0;
      }
    }
  }

  // Fetch metadata for tokens with meaningful activity
  const mintEntries = Array.from(tokenMap.entries())
    .filter(([_, v]) => v.buySol > 0.001 || v.sellSol > 0.001)
    .sort((a, b) => b[1].lastTimestamp - a[1].lastTimestamp);

  // Fetch pump.fun metadata in batches
  const trades: Trade[] = [];
  for (let i = 0; i < Math.min(mintEntries.length, 50); i += 5) {
    const batch = mintEntries.slice(i, i + 5);
    const results = await Promise.allSettled(
      batch.map(async ([mint, data]) => {
        let name = "Unknown", symbol = "???", image: string | null = null;
        try {
          const res = await fetch(`https://frontend-api-v3.pump.fun/coins/${mint}`, {
            signal: AbortSignal.timeout(3000),
          });
          if (res.ok) {
            const text = await res.text();
            if (text) {
              const coin = JSON.parse(text);
              name = coin.name || name;
              symbol = coin.symbol || symbol;
              image = coin.image_uri || null;
            }
          }
        } catch {}

        const profitSol = data.sellSol - data.buySol;
        const profitPct = data.buySol > 0 ? (profitSol / data.buySol) * 100 : 0;

        return {
          mint,
          name,
          symbol,
          image,
          buyAmountSol: Math.round(data.buySol * 1000) / 1000,
          sellAmountSol: Math.round(data.sellSol * 1000) / 1000,
          profitSol: Math.round(profitSol * 1000) / 1000,
          profitPct: Math.round(profitPct),
          closed: data.sellSol > 0,
          timestamp: data.lastTimestamp,
        };
      })
    );

    for (const r of results) {
      if (r.status === "fulfilled") trades.push(r.value);
    }
  }

  // Calculate stats (only from closed positions)
  const closedTrades = trades.filter(t => t.closed && t.buyAmountSol > 0);
  const wins = closedTrades.filter(t => t.profitSol > 0).length;
  const losses = closedTrades.filter(t => t.profitSol <= 0).length;
  const totalTrades = closedTrades.length;
  const winRate = totalTrades > 0 ? Math.round((wins / totalTrades) * 100) : 0;
  const totalPnlSol = closedTrades.reduce((sum, t) => sum + t.profitSol, 0);
  const avgProfitPct = totalTrades > 0 ? Math.round(closedTrades.reduce((sum, t) => sum + t.profitPct, 0) / totalTrades) : 0;

  const sortedByProfit = [...closedTrades].sort((a, b) => b.profitSol - a.profitSol);
  const bestTrade = sortedByProfit[0] || null;
  const worstTrade = sortedByProfit[sortedByProfit.length - 1] || null;

  return {
    trades,
    totalPnlSol: Math.round(totalPnlSol * 1000) / 1000,
    winRate,
    wins,
    losses,
    totalTrades,
    avgProfitPct,
    bestTrade,
    worstTrade,
    isSmartMoney: SMART_MONEY_WALLETS.has(wallet),
  };
}

// GET: list smart money wallets
export async function GET() {
  return NextResponse.json({
    wallets: Array.from(SMART_MONEY_WALLETS),
  });
}

// POST: get wallet PnL
export async function POST(req: NextRequest) {
  try {
    const { wallet } = await req.json();
    if (!wallet) return NextResponse.json({ error: "Missing wallet" }, { status: 400 });

    const result = await getWalletPnL(wallet);
    return NextResponse.json(result);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "PnL analysis failed" },
      { status: 500 }
    );
  }
}
