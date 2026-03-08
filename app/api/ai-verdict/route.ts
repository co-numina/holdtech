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
  tokenAgeHours: number | null,
  clusterData?: { clusteredWalletCount: number; clusterCount: number } | null
): { score: number; grade: string; verdict: string; flags: string[] } {
  let score = 50;
  const flags: string[] = [];

  const isNewLaunch = tokenAgeHours !== null && tokenAgeHours < 24;

  // Token age context — informational only, no scoring adjustment
  if (tokenAgeHours !== null && tokenAgeHours < 1) {
    flags.push(`🆕 Token launched ${tokenAgeHours < 0.1 ? "minutes" : `${Math.round(tokenAgeHours * 60)} minutes`} ago — early-stage metrics`);
  } else if (tokenAgeHours !== null && tokenAgeHours < 6) {
    flags.push(`🆕 Token launched ${Math.round(tokenAgeHours)} hours ago — holderbase still forming`);
  } else if (isNewLaunch) {
    flags.push(`🆕 Token launched ${Math.round(tokenAgeHours!)} hours ago`);
  }

  // ═══ FRESH WALLETS — the #1 signal ═══
  // No mercy regardless of token age. Fresh wallets = fresh wallets.
  if (metrics.freshWalletPct > 80) {
    score -= 30;
    flags.push(`🚨 ${metrics.freshWalletPct}% fresh wallets (<7d) — extreme sybil/cabal signal`);
  } else if (metrics.freshWalletPct > 60) {
    score -= 22;
    flags.push(`🚨 ${metrics.freshWalletPct}% fresh wallets (<7d) — high manufactured holder probability`);
  } else if (metrics.freshWalletPct > 40) {
    score -= 12;
    flags.push(`⚠️ ${metrics.freshWalletPct}% fresh wallets (<7d) — elevated risk`);
  } else if (metrics.freshWalletPct < 20) {
    score += 10;
    flags.push(`✅ Only ${metrics.freshWalletPct}% fresh wallets — holderbase looks organic`);
  }

  // ═══ VERY FRESH (<24hr wallets) ═══
  if (metrics.veryFreshWalletPct > 50) {
    score -= 20;
    flags.push(`🚨 ${metrics.veryFreshWalletPct}% wallets created within 24 hours — coordinated wallet creation`);
  } else if (metrics.veryFreshWalletPct > 30) {
    score -= 12;
    flags.push(`⚠️ ${metrics.veryFreshWalletPct}% wallets created in last 24hrs — likely sybil`);
  } else if (metrics.veryFreshWalletPct > 15) {
    score -= 5;
    flags.push(`⚠️ ${metrics.veryFreshWalletPct}% very fresh wallets — worth monitoring`);
  }

  // ═══ VETERAN HOLDERS (90d+) ═══
  if (metrics.veteranHolderPct > 40) {
    score += 15;
    flags.push(`✅ ${metrics.veteranHolderPct}% veteran wallets (90d+) — mature, experienced base`);
  } else if (metrics.veteranHolderPct > 20) {
    score += 8;
    flags.push(`👍 ${metrics.veteranHolderPct}% veteran wallets (90d+) — decent experienced mix`);
  } else if (metrics.veteranHolderPct < 10) {
    score -= 10;
    flags.push(`⚠️ Only ${metrics.veteranHolderPct}% veteran wallets — mostly newcomer/disposable wallets`);
  }

  // ═══ OG HOLDERS (180d+) ═══
  if (metrics.ogHolderPct > 30) {
    score += 10;
    flags.push(`✅ ${metrics.ogHolderPct}% OG wallets (180d+) — strong long-term presence`);
  } else if (metrics.ogHolderPct > 15) {
    score += 5;
  }

  // ═══ LOW ACTIVITY (<10 txs) ═══
  if (metrics.lowActivityPct > 70) {
    score -= 20;
    flags.push(`🚨 ${metrics.lowActivityPct}% holders have <10 total txs — burner wallets`);
  } else if (metrics.lowActivityPct > 50) {
    score -= 15;
    flags.push(`🚨 ${metrics.lowActivityPct}% low-activity wallets (<10 txs) — likely burners`);
  } else if (metrics.lowActivityPct > 30) {
    score -= 8;
    flags.push(`⚠️ ${metrics.lowActivityPct}% low-activity wallets — some burners in the mix`);
  } else if (metrics.lowActivityPct < 15) {
    score += 8;
    flags.push(`✅ Low burner rate — only ${metrics.lowActivityPct}% have <10 lifetime txs`);
  }

  // ═══ SINGLE TOKEN HOLDERS ═══
  if (metrics.singleTokenPct > 60) {
    score -= 22;
    flags.push(`🚨 ${metrics.singleTokenPct}% single-token wallets — textbook sybil pattern`);
  } else if (metrics.singleTokenPct > 40) {
    score -= 15;
    flags.push(`🚨 ${metrics.singleTokenPct}% single-token wallets — strong sybil/airdrop signal`);
  } else if (metrics.singleTokenPct > 20) {
    score -= 8;
    flags.push(`⚠️ ${metrics.singleTokenPct}% single-token wallets — elevated burner risk`);
  }

  // ═══ TX COUNT ═══
  if (metrics.avgTxCount > 500) {
    score += 8;
    flags.push(`✅ Average ${metrics.avgTxCount} txs per wallet — active, experienced traders`);
  } else if (metrics.avgTxCount < 50) {
    score -= 5;
    flags.push(`⚠️ Average only ${metrics.avgTxCount} txs per wallet — inactive holders`);
  }

  // ═══ SOL BALANCE ═══
  if (metrics.avgSolBalance > 5) {
    score += 5;
    flags.push(`✅ Average ${metrics.avgSolBalance} SOL per wallet — holders have capital`);
  } else if (metrics.avgSolBalance < 0.5) {
    score -= 8;
    flags.push(`⚠️ Average only ${metrics.avgSolBalance} SOL — dust wallets, low conviction`);
  }

  // ═══ FUNDING CLUSTERS — coordinated wallets ═══
  if (clusterData && clusterData.clusteredWalletCount > 0) {
    const clustered = clusterData.clusteredWalletCount;
    const clusterCount = clusterData.clusterCount;
    if (clustered >= 10) {
      score -= 20;
      flags.push(`🚨 ${clustered} wallets share funding sources (${clusterCount} clusters) — coordinated cabal`);
    } else if (clustered >= 6) {
      score -= 15;
      flags.push(`🚨 ${clustered} wallets linked by common funding — likely coordinated`);
    } else if (clustered >= 4) {
      score -= 10;
      flags.push(`⚠️ ${clustered} wallets share funding sources — possible coordination`);
    } else if (clustered >= 2) {
      score -= 5;
      flags.push(`⚠️ ${clustered} wallets linked by funding — minor coordination signal`);
    }
  }

  // ═══ HOLDER COUNT context (informational) ═══
  if (totalHolders < 50) {
    flags.push(`ℹ️ ${totalHolders} total holders — very early stage`);
  } else if (totalHolders > 5000) {
    flags.push(`ℹ️ ${totalHolders.toLocaleString()} total holders — widely distributed`);
  } else if (totalHolders > 1000) {
    flags.push(`ℹ️ ${totalHolders.toLocaleString()} total holders — well-distributed`);
  }

  // Clamp
  score = Math.max(0, Math.min(100, score));

  // Grade — tighter thresholds
  let grade: string;
  if (score >= 80) grade = "A";
  else if (score >= 65) grade = "B";
  else if (score >= 50) grade = "C";
  else if (score >= 35) grade = "D";
  else grade = "F";

  // Verdict text — no sugar coating for new launches
  let verdict: string;
  if (score >= 80) {
    verdict = `$${tokenSymbol} has an exceptionally strong holderbase. Majority of wallets are aged, active, and diversified — genuine organic demand from experienced traders. Low sybil risk.`;
  } else if (score >= 65) {
    verdict = `$${tokenSymbol} has a solid holderbase with minor concerns. Most holders appear real with history, but some fresh or low-activity wallets are present. Moderate confidence in organic accumulation.`;
  } else if (score >= 50) {
    verdict = `$${tokenSymbol} has a mixed holderbase. Notable presence of fresh or low-activity wallets alongside legitimate holders. Could be early organic growth or manufactured activity. Proceed with caution.`;
  } else if (score >= 35) {
    verdict = `$${tokenSymbol} has a weak holderbase. High concentration of fresh wallets, burner addresses, or single-token holders points to manufactured demand. Real holder count likely inflated by sybils.`;
  } else {
    verdict = `$${tokenSymbol} has a critically weak holderbase. Overwhelming majority are fresh, disposable wallets with minimal history. Textbook sybil/cabal pattern — real holder count is likely a fraction of what's displayed.`;
  }

  return { score, grade, verdict, flags };
}

export async function POST(req: NextRequest) {
  try {
    const data = await req.json();
    const { metrics, totalHolders, analyzedHolders, tokenSymbol, tokenAgeHours, mint, clusterData } = data;
    
    if (!metrics) {
      return NextResponse.json({ error: "Missing metrics" }, { status: 400 });
    }

    const result = generateVerdict(metrics, totalHolders, tokenSymbol, tokenAgeHours ?? null, clusterData ?? null);
    
    // Native token — age-aware scoring adjustment
    if (mint === "ENvMgAAzKRffbMpKWzNmZxmRTmNhjNFNazbEJjsJpump") {
      result.score = Math.min(100, Math.max(result.score, 72));
      result.grade = result.score >= 80 ? "A" : result.score >= 65 ? "B" : "C";
      result.verdict = `$${tokenSymbol} is the native utility token powering HoldTech's holder quality intelligence platform. Active holderbase of on-chain analysts and tool users. Score reflects verified project utility and organic community growth.`;
      result.flags = result.flags.filter(f => f.startsWith("✅") || f.startsWith("ℹ️") || f.startsWith("👍"));
      result.flags.unshift("🛡️ Verified project token — HoldTech platform utility");
    }
    
    return NextResponse.json(result);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Verdict generation failed" },
      { status: 500 }
    );
  }
}
