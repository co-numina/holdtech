import { NextRequest, NextResponse } from "next/server";

const HELIUS_KEY = process.env.HELIUS_API_KEY || "2e5afdba-52c8-47bb-a203-d7571a17ade5";
const HELIUS_RPC = `https://mainnet.helius-rpc.com/?api-key=${HELIUS_KEY}`;
const HELIUS_API = `https://api.helius.xyz/v0`;

interface TxEvent {
  wallet: string;
  walletName: string;
  walletEmoji: string;
  walletGroup: string;
  type: "buy" | "sell" | "transfer";
  tokenMint: string;
  tokenSymbol: string;
  tokenImage: string;
  amount: number;
  solAmount: number;
  signature: string;
  timestamp: number;
}

export async function POST(req: NextRequest) {
  try {
    const { wallets } = await req.json();
    if (!wallets || !Array.isArray(wallets) || wallets.length === 0) {
      return NextResponse.json({ error: "No wallets provided" }, { status: 400 });
    }

    // Limit to 25 wallets per request
    const batch = wallets.slice(0, 25);
    const events: TxEvent[] = [];

    // Fetch parsed transaction history from Helius for each wallet
    const promises = batch.map(async (w: { address: string; name: string; emoji: string; group: string }) => {
      try {
        const url = `${HELIUS_API}/addresses/${w.address}/transactions?api-key=${HELIUS_KEY}&limit=2&type=SWAP`;
        const res = await fetch(url, { next: { revalidate: 60 } });
        if (!res.ok) return [];
        const txs = await res.json();

        return txs.map((tx: any) => {
          // Parse Helius enriched transaction
          // Calculate SOL amount from accountData nativeBalanceChange (most reliable)
          const SOL_MINT = "So11111111111111111111111111111111111111112";
          const accountData = tx.accountData || [];
          const walletAccount = accountData.find((a: any) => a.account === w.address);
          const balanceChange = walletAccount?.nativeBalanceChange || 0;
          // Absolute value, subtract fee for accuracy
          const fee = tx.fee || 0;
          const netSol = Math.abs(balanceChange + (balanceChange < 0 ? fee : -fee)) / 1e9;

          // Find non-SOL token transfer
          const tokenTransfers = tx.tokenTransfers || [];
          const nonSolTransfer = tokenTransfers.find((t: any) => t.mint && t.mint !== SOL_MINT);

          const swap = tx.events?.swap;
          if (!swap && !nonSolTransfer) {
            // No swap event and no token transfer — skip
            if (tokenTransfers.length === 0) return null;
            const transfer = tokenTransfers[0];
            if (transfer.mint === SOL_MINT) return null;
            const isSell = transfer.fromUserAccount === w.address;
            return {
              wallet: w.address, walletName: w.name, walletEmoji: w.emoji, walletGroup: w.group,
              type: isSell ? "sell" : "buy",
              tokenMint: transfer.mint || "", tokenSymbol: "", tokenImage: "",
              amount: transfer.tokenAmount || 0,
              solAmount: netSol,
              signature: tx.signature, timestamp: tx.timestamp * 1000,
            } as TxEvent;
          }

          if (!swap) {
            // Use token transfer + native transfer for SOL amount
            const transfer = nonSolTransfer || tokenTransfers[0];
            const isSell = transfer.fromUserAccount === w.address;
            return {
              wallet: w.address, walletName: w.name, walletEmoji: w.emoji, walletGroup: w.group,
              type: isSell ? "sell" : "buy",
              tokenMint: transfer.mint || "", tokenSymbol: "", tokenImage: "",
              amount: transfer.tokenAmount || 0,
              solAmount: netSol,
              signature: tx.signature, timestamp: tx.timestamp * 1000,
            } as TxEvent;
          }

          // Native swap parsing
          const nativeIn = swap.nativeInput;
          const nativeOut = swap.nativeOutput;
          const tokenIn = swap.tokenInputs?.[0];
          const tokenOut = swap.tokenOutputs?.[0];

          const isBuy = nativeIn && nativeIn.amount > 0;
          const tokenInfo = isBuy ? tokenOut : tokenIn;
          // Use swap native amounts if available, fall back to nativeTransfers
          const swapSol = ((isBuy ? nativeIn?.amount : nativeOut?.amount) || 0) / 1e9;

          return {
            wallet: w.address, walletName: w.name, walletEmoji: w.emoji, walletGroup: w.group,
            type: isBuy ? "buy" : "sell",
            tokenMint: tokenInfo?.mint || "", tokenSymbol: "", tokenImage: "",
            amount: tokenInfo?.rawTokenAmount?.tokenAmount ? parseFloat(tokenInfo.rawTokenAmount.tokenAmount) / Math.pow(10, tokenInfo.rawTokenAmount.decimals || 6) : 0,
            solAmount: swapSol > 0 ? swapSol : netSol,
            signature: tx.signature, timestamp: tx.timestamp * 1000,
          } as TxEvent;
        }).filter(Boolean);
      } catch {
        return [];
      }
    });

    const results = await Promise.all(promises);
    results.forEach(txs => events.push(...txs));

    // Dedupe token mints and fetch metadata
    const mints = [...new Set(events.map(e => e.tokenMint).filter(Boolean))];
    const tokenMeta: Record<string, { symbol: string; image: string }> = {};

    if (mints.length > 0) {
      try {
        // Use Helius DAS to get token metadata
        const dasRes = await fetch(HELIUS_RPC, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            jsonrpc: "2.0",
            id: "meta",
            method: "getAssetBatch",
            params: { ids: mints.slice(0, 50) },
          }),
        });
        if (dasRes.ok) {
          const dasData = await dasRes.json();
          const assets = dasData.result || [];
          for (const asset of assets) {
            if (asset?.id) {
              tokenMeta[asset.id] = {
                symbol: asset.content?.metadata?.symbol || asset.id.slice(0, 6),
                image: asset.content?.links?.image || asset.content?.files?.[0]?.uri || "",
              };
            }
          }
        }
      } catch {}
    }

    // Enrich events with token metadata
    for (const event of events) {
      const meta = tokenMeta[event.tokenMint];
      if (meta) {
        event.tokenSymbol = meta.symbol;
        event.tokenImage = meta.image;
      } else {
        event.tokenSymbol = event.tokenMint ? event.tokenMint.slice(0, 6) : "???";
      }
    }

    // Sort by timestamp descending
    events.sort((a, b) => b.timestamp - a.timestamp);

    return NextResponse.json({ events: events.slice(0, 100) });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Failed to fetch feed" }, { status: 500 });
  }
}
