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

function generateVerdict(
  metrics: Metrics,
  totalHolders: number,
  tokenSymbol: string,
  tokenAgeHours: number | null
): { score: number; grade: string; verdict: string; flags: string[] } {
  let score = 50;
  const flags: string[] = [];

  const isNewLaunch = tokenAgeHours !== null && tokenAgeHours < 24;
  const isVeryNew = tokenAgeHours !== null && tokenAgeHours < 1;
  const isFreshLaunch = tokenAgeHours !== null && tokenAgeHours < 6;

  // Token age context — add upfront
  if (isVeryNew) {
    flags.push(`🆕 Token launched ${tokenAgeHours < 0.1 ? "minutes" : `${Math.round(tokenAgeHours * 60)} minutes`} ago — early-stage metrics, fresh wallets are expected`);
  } else if (isFreshLaunch) {
    flags.push(`🆕 Token launched ${Math.round(tokenAgeHours)} hours ago — holderbase is still forming, some metrics may shift`);
  } else if (isNewLaunch) {
    flags.push(`🆕 Token launched ${Math.round(tokenAgeHours)} hours ago — still early, metrics will stabilize over time`);
  }

  // Fresh wallet analysis — adjusted for token age
  if (isVeryNew) {
    // Token <1hr old: don't penalize fresh wallets at all
    if (metrics.freshWalletPct < 80) {
      score += 10;
      flags.push(`✅ ${100 - metrics.freshWalletPct}% of holders have aged wallets despite being a brand new launch — promising organic interest`);
    }
    // Only flag if there are literally zero veteran wallets
    if (metrics.veteranHolderPct > 5) {
      score += 10;
      flags.push(`✅ ${metrics.veteranHolderPct}% veteran wallets (90d+) buying into a new launch — experienced interest`);
    }
  } else if (isFreshLaunch) {
    // 1-6hrs: mild penalties only for extreme cases
    if (metrics.freshWalletPct > 80) {
      score -= 8;
      flags.push(`⚠️ ${metrics.freshWalletPct}% fresh wallets — high even for a new launch, possible sybil activity`);
    } else if (metrics.freshWalletPct < 50) {
      score += 12;
      flags.push(`✅ Only ${metrics.freshWalletPct}% fresh wallets on a ${Math.round(tokenAgeHours)}hr-old token — strong organic signal`);
    }
    if (metrics.veteranHolderPct > 20) {
      score += 10;
      flags.push(`✅ ${metrics.veteranHolderPct}% veteran wallets buying into a young token — experienced demand`);
    }
  } else if (isNewLaunch) {
    // 6-24hrs: moderate adjustment
    if (metrics.freshWalletPct > 70) {
      score -= 15;
      flags.push(`⚠️ ${metrics.freshWalletPct}% fresh wallets after ${Math.round(tokenAgeHours)}hrs — still elevated, monitor for organic growth`);
    } else if (metrics.freshWalletPct < 40) {
      score += 10;
      flags.push(`✅ ${metrics.freshWalletPct}% fresh wallets after ${Math.round(tokenAgeHours)}hrs — holderbase maturing well`);
    }
    if (metrics.veteranHolderPct > 20) {
      score += 8;
      flags.push(`✅ ${metrics.veteranHolderPct}% veteran wallets (90d+) — decent experienced holder presence`);
    } else if (metrics.veteranHolderPct < 10) {
      score -= 5;
      flags.push(`⚠️ Only ${metrics.veteranHolderPct}% veteran wallets — mostly newcomer wallets`);
    }
  } else {
    // Mature token (>24hrs or unknown age): original scoring
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
  }

  // Very fresh (< 24hrs) — adjusted for token age
  if (!isNewLaunch) {
    if (metrics.veryFreshWalletPct > 30) {
      score -= 20;
      flags.push(`🚨 ${metrics.veryFreshWalletPct}% of wallets created within 24 hours — likely sybil attack or coordinated buy`);
    }
  } else if (isFreshLaunch && metrics.veryFreshWalletPct > 60) {
    // Only flag extreme cases on new launches
    score -= 5;
    flags.push(`⚠️ ${metrics.veryFreshWalletPct}% wallets created in last 24hrs — common for new launches but worth monitoring`);
  }

  // OG holders (180d+) — always positive
  if (metrics.ogHolderPct > 30) {
    score += 10;
    flags.push(`✅ ${metrics.ogHolderPct}% OG wallets (180d+) — strong long-term holder presence`);
  } else if (metrics.ogHolderPct > 15 && !isNewLaunch) {
    score += 5;
  }

  // Low activity wallets — adjusted for new launches
  if (isNewLaunch) {
    // New launches: only flag extreme low activity
    if (metrics.lowActivityPct > 70) {
      score -= 10;
      flags.push(`⚠️ ${metrics.lowActivityPct}% low-activity wallets (<10 txs) — higher than expected even for a new launch`);
    }
  } else {
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
  }

  // Single token holders — adjusted for new launches
  if (isNewLaunch) {
    if (metrics.singleTokenPct > 60) {
      score -= 10;
      flags.push(`⚠️ ${metrics.singleTokenPct}% single-token wallets — elevated even for a new launch`);
    }
  } else {
    if (metrics.singleTokenPct > 40) {
      score -= 20;
      flags.push(`🚨 ${metrics.singleTokenPct}% of holders only hold this one token — strong sybil/airdrop signal`);
    } else if (metrics.singleTokenPct > 20) {
      score -= 10;
      flags.push(`⚠️ ${metrics.singleTokenPct}% single-token wallets — elevated burner risk`);
    }
  }

  // Average tx count
  if (metrics.avgTxCount > 500) {
    score += 8;
    flags.push(`✅ Average ${metrics.avgTxCount} txs per wallet — active, experienced traders`);
  } else if (metrics.avgTxCount < 50 && !isNewLaunch) {
    score -= 5;
    flags.push(`⚠️ Average only ${metrics.avgTxCount} txs per wallet — relatively inactive holders`);
  }

  // SOL balance
  if (metrics.avgSolBalance > 5) {
    score += 5;
    flags.push(`✅ Average ${metrics.avgSolBalance} SOL per wallet — holders have capital`);
  } else if (metrics.avgSolBalance < 0.5 && !isNewLaunch) {
    score -= 8;
    flags.push(`⚠️ Average only ${metrics.avgSolBalance} SOL — dust wallets, low conviction`);
  }

  // Holder count context
  if (totalHolders < 50) {
    flags.push(`ℹ️ ${totalHolders} total holders — very early stage, metrics may shift as more wallets enter`);
  } else if (totalHolders > 5000) {
    flags.push(`ℹ️ ${totalHolders.toLocaleString()} total holders — widely distributed token`);
  } else if (totalHolders > 1000) {
    flags.push(`ℹ️ ${totalHolders.toLocaleString()} total holders — well-distributed`);
  }

  // Clamp
  score = Math.max(0, Math.min(100, score));

  // Grade
  let grade: string;
  if (score >= 80) grade = "A";
  else if (score >= 65) grade = "B";
  else if (score >= 50) grade = "C";
  else if (score >= 35) grade = "D";
  else grade = "F";

  // Verdict text
  let verdict: string;
  if (isNewLaunch) {
    const ageStr = tokenAgeHours! < 1 ? `${Math.round(tokenAgeHours! * 60)} minutes` : `${Math.round(tokenAgeHours!)} hours`;
    if (score >= 65) {
      verdict = `$${tokenSymbol} launched ${ageStr} ago and shows strong early signals. Experienced wallets are already accumulating, and the holder profile looks organic for this stage. Worth watching as distribution develops.`;
    } else if (score >= 50) {
      verdict = `$${tokenSymbol} launched ${ageStr} ago with a mixed early holderbase. Some experienced wallets are present, but fresh/low-activity addresses dominate — which is common at launch. Rescan after a few hours to see how distribution evolves.`;
    } else if (score >= 35) {
      verdict = `$${tokenSymbol} launched ${ageStr} ago. The early holderbase leans toward fresh and low-activity wallets. This could be normal launch dynamics or early bundling. Monitor closely — rescan as more holders enter.`;
    } else {
      verdict = `$${tokenSymbol} launched ${ageStr} ago and the early holderbase shows concerning patterns even for a new launch — very high fresh wallet concentration and low wallet quality. Could indicate pre-planned sybil activity. Exercise caution.`;
    }
  } else {
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
  }

  return { score, grade, verdict, flags };
}

export async function POST(req: NextRequest) {
  try {
    const data = await req.json();
    const { metrics, totalHolders, analyzedHolders, tokenSymbol, tokenAgeHours } = data;
    
    if (!metrics) {
      return NextResponse.json({ error: "Missing metrics" }, { status: 400 });
    }

    const result = generateVerdict(metrics, totalHolders, tokenSymbol, tokenAgeHours ?? null);
    return NextResponse.json(result);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Verdict generation failed" },
      { status: 500 }
    );
  }
}
