import { NextRequest, NextResponse } from "next/server";

interface Metrics {
  avgWalletAgeDays: number;
  medianWalletAgeDays: number;
  freshWalletPct: number;
  veryFreshWalletPct: number;
  diamondHandsPct: number;
  veteranHolderPct: number;
  ogHolderPct: number;
  avgTxCount: number;
  lowActivityPct: number;
  avgSolBalance: number;
  singleTokenPct: number;
}

function generateVerdict(metrics: Metrics, totalHolders: number, tokenSymbol: string): { score: number; grade: string; verdict: string; flags: string[] } {
  let score = 50; // Start neutral
  const flags: string[] = [];

  // Fresh wallet analysis (biggest red flag)
  if (metrics.freshWalletPct > 60) {
    score -= 25;
    flags.push(`🚨 ${metrics.freshWalletPct}% of holders have wallets less than 7 days old — extremely high cabal/sybil probability`);
  } else if (metrics.freshWalletPct > 40) {
    score -= 15;
    flags.push(`⚠️ ${metrics.freshWalletPct}% fresh wallets (<7d) — elevated risk of manufactured holders`);
  } else if (metrics.freshWalletPct < 20) {
    score += 10;
    flags.push(`✅ Only ${metrics.freshWalletPct}% fresh wallets — holderbase looks organic`);
  }

  // Very fresh (< 24hrs)
  if (metrics.veryFreshWalletPct > 30) {
    score -= 20;
    flags.push(`🚨 ${metrics.veryFreshWalletPct}% of wallets created within 24 hours — likely sybil attack or coordinated buy`);
  }

  // Veteran holders
  if (metrics.veteranHolderPct > 40) {
    score += 15;
    flags.push(`✅ ${metrics.veteranHolderPct}% of holders have wallets 90+ days old — mature, experienced base`);
  } else if (metrics.veteranHolderPct > 20) {
    score += 8;
    flags.push(`👍 ${metrics.veteranHolderPct}% veteran wallets (90d+) — decent mix of experienced holders`);
  } else if (metrics.veteranHolderPct < 10) {
    score -= 10;
    flags.push(`⚠️ Only ${metrics.veteranHolderPct}% veteran wallets — mostly newcomer/disposable wallets`);
  }

  // OG holders (180d+)
  if (metrics.ogHolderPct > 30) {
    score += 10;
    flags.push(`✅ ${metrics.ogHolderPct}% OG wallets (180d+) — strong long-term holder presence`);
  }

  // Low activity wallets
  if (metrics.lowActivityPct > 50) {
    score -= 15;
    flags.push(`🚨 ${metrics.lowActivityPct}% of holders have fewer than 10 total transactions — likely burner wallets`);
  } else if (metrics.lowActivityPct > 30) {
    score -= 8;
    flags.push(`⚠️ ${metrics.lowActivityPct}% low-activity wallets (<10 txs) — some burners in the mix`);
  } else if (metrics.lowActivityPct < 15) {
    score += 8;
    flags.push(`✅ Low burner rate — only ${metrics.lowActivityPct}% of holders have <10 lifetime txs`);
  }

  // Single token holders (extreme sybil signal)
  if (metrics.singleTokenPct > 40) {
    score -= 20;
    flags.push(`🚨 ${metrics.singleTokenPct}% of holders only hold this one token — strong sybil/airdrop signal`);
  } else if (metrics.singleTokenPct > 20) {
    score -= 10;
    flags.push(`⚠️ ${metrics.singleTokenPct}% single-token wallets — elevated burner risk`);
  }

  // Average tx count (wallet maturity)
  if (metrics.avgTxCount > 500) {
    score += 8;
    flags.push(`✅ Average ${metrics.avgTxCount} txs per wallet — active, experienced traders`);
  } else if (metrics.avgTxCount < 50) {
    score -= 5;
    flags.push(`⚠️ Average only ${metrics.avgTxCount} txs per wallet — relatively inactive holders`);
  }

  // SOL balance (skin in the game)
  if (metrics.avgSolBalance > 5) {
    score += 5;
    flags.push(`✅ Average ${metrics.avgSolBalance} SOL per wallet — holders have capital`);
  } else if (metrics.avgSolBalance < 0.5) {
    score -= 8;
    flags.push(`⚠️ Average only ${metrics.avgSolBalance} SOL — dust wallets, low conviction`);
  }

  // Holder count context
  if (totalHolders < 50) {
    flags.push(`ℹ️ Only ${totalHolders} total holders — very early stage, metrics may be volatile`);
  } else if (totalHolders > 1000) {
    flags.push(`ℹ️ ${totalHolders} total holders — well-distributed`);
  }

  // Clamp score
  score = Math.max(0, Math.min(100, score));

  // Grade
  let grade: string;
  if (score >= 80) grade = "A";
  else if (score >= 65) grade = "B";
  else if (score >= 50) grade = "C";
  else if (score >= 35) grade = "D";
  else grade = "F";

  // Generate verdict
  let verdict: string;
  if (score >= 80) {
    verdict = `$${tokenSymbol} has an exceptionally strong holderbase. The majority of wallets are aged, active, and diversified — this looks like genuine organic demand from experienced traders. Low sybil risk.`;
  } else if (score >= 65) {
    verdict = `$${tokenSymbol} has a solid holderbase with some concerns. Most holders appear to be real wallets with history, but there are pockets of fresh or low-activity wallets worth monitoring. Moderate confidence in organic accumulation.`;
  } else if (score >= 50) {
    verdict = `$${tokenSymbol} has a mixed holderbase. There's a notable presence of fresh wallets and/or low-activity addresses alongside legitimate holders. Could be early-stage organic growth, or could indicate some manufactured activity. Proceed with caution.`;
  } else if (score >= 35) {
    verdict = `$${tokenSymbol} has a weak holderbase. High concentration of fresh wallets, burner addresses, or single-token holders suggests manufactured demand. The "holder count" is likely inflated by sybil wallets. High risk.`;
  } else {
    verdict = `$${tokenSymbol} has a critically weak holderbase. The overwhelming majority of holders appear to be fresh, disposable wallets with minimal history. This is a textbook sybil/cabal pattern. Extreme caution advised — the real holder count is likely a fraction of what's shown.`;
  }

  return { score, grade, verdict, flags };
}

export async function POST(req: NextRequest) {
  try {
    const data = await req.json();
    const { metrics, totalHolders, tokenSymbol } = data;
    
    if (!metrics) {
      return NextResponse.json({ error: "Missing metrics" }, { status: 400 });
    }

    const result = generateVerdict(metrics, totalHolders, tokenSymbol);
    return NextResponse.json(result);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Verdict generation failed" },
      { status: 500 }
    );
  }
}
