"use client";
import { useState, useCallback, useEffect, useRef } from "react";

// ============================================================
// TYPES
// ============================================================
interface WalletAnalysis {
  address: string;
  balance: number;
  walletAgeDays: number;
  holdDurationDays: number;
  totalTxCount: number;
  isFresh: boolean;
  solBalance: number;
  otherTokenCount: number;
}

interface DistBucket { label: string; count: number; pct: number; }

interface AnalysisResult {
  mint: string;
  tokenName: string;
  tokenSymbol: string;
  totalHolders: number;
  analyzedHolders: number;
  metrics: {
    avgWalletAgeDays: number;
    medianWalletAgeDays: number;
    avgHoldDurationDays: number;
    medianHoldDurationDays: number;
    freshWalletPct: number;
    veryFreshWalletPct: number;
    diamondHandsPct: number;
    veteranHolderPct: number;
    ogHolderPct: number;
    avgTxCount: number;
    lowActivityPct: number;
    avgSolBalance: number;
    singleTokenPct: number;
  };
  distribution: { walletAge: DistBucket[]; holdDuration: DistBucket[]; };
  topHolders: { address: string; balancePct: number; walletAgeDays: number; holdDurationDays: number; totalTxCount: number; isFresh: boolean; }[];
  wallets: WalletAnalysis[];
  totalSupply: number;
}

interface Verdict { score: number; grade: string; verdict: string; flags: string[]; }

interface TokenInfo {
  name: string;
  symbol: string;
  image: string | null;
  description: string | null;
  website: string | null;
  twitter: string | null;
  price: number | null;
  priceNative: number | null;
  mcap: number | null;
  volume24h: number | null;
  liquidity: number | null;
  priceChange: { m5: number | null; h1: number | null; h6: number | null; h24: number | null };
  holderCount: number | null;
  pairAddress: string | null;
  dexId: string | null;
  sparkline: number[];
}

interface DeepScanResult {
  txHistoryCount: number;
  bundles: { slot: number; timestamp: number; wallets: string[]; txCount: number }[];
  bundleCount: number;
  bundledWalletCount: number;
  buyTimeline: { wallet: string; timestamp: number; slot: number; signature: string; minutesAfterFirst: number }[];
  concentration: { top5Pct: number; top10Pct: number; top20Pct: number; giniCoefficient: number; herfindahlIndex: number };
  solDistribution: { dust: number; low: number; medium: number; high: number; whale: number };
  fundingSources: { wallet: string; fundedBy: string | null; fundingTxSig: string | null; fundingAmount: number }[];
  fundingClusters: { funder: string; wallets: string[]; count: number }[];
  clusterCount: number;
  clusteredWalletCount: number;
}

// ============================================================
// ICONS (inline SVG)
// ============================================================
const Icon = ({ d, size = 18, color = "currentColor" }: { d: string; size?: number; color?: string }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"><path d={d} /></svg>
);

const SearchIcon = ({ size = 18, color = "currentColor" }: { size?: number; color?: string }) => <Icon d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" size={size} color={color} />;
const ShieldIcon = ({ size = 18, color = "currentColor" }: { size?: number; color?: string }) => <Icon d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" size={size} color={color} />;
const AlertIcon = ({ size = 18, color = "currentColor" }: { size?: number; color?: string }) => <Icon d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0zM12 9v4m0 4h.01" size={size} color={color} />;
const EyeIcon = ({ size = 18, color = "currentColor" }: { size?: number; color?: string }) => <Icon d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8zm10 3a3 3 0 100-6 3 3 0 000 6z" size={size} color={color} />;
const TargetIcon = ({ size = 18, color = "currentColor" }: { size?: number; color?: string }) => <Icon d="M22 12h-4M6 12H2M12 6V2m0 20v-4m7.07-2.93l-2.83-2.83M7.76 7.76L4.93 4.93m0 14.14l2.83-2.83m9.48 0l2.83 2.83M12 12a3 3 0 100-6 3 3 0 000 6z" size={size} color={color} />;
const LayersIcon = ({ size = 18, color = "currentColor" }: { size?: number; color?: string }) => <Icon d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" size={size} color={color} />;
const TrendIcon = ({ size = 18, color = "currentColor" }: { size?: number; color?: string }) => <Icon d="M23 6l-9.5 9.5-5-5L1 18" size={size} color={color} />;
const GitHubIcon = ({ size = 18, color = "currentColor" }: { size?: number; color?: string }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill={color}><path d="M12 0C5.374 0 0 5.373 0 12c0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23A11.509 11.509 0 0112 5.803c1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576C20.566 21.797 24 17.3 24 12c0-6.627-5.373-12-12-12z"/></svg>
);
const XIcon = ({ size = 18, color = "currentColor" }: { size?: number; color?: string }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill={color}><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>
);
const PumpFunIcon = ({ size = 18 }: { size?: number }) => (
  <img src="/pumpfun.png" alt="Pump.fun" width={size} height={size} style={{ objectFit: "contain", borderRadius: 4 }} />
);
const DexScreenerIcon = ({ size = 18 }: { size?: number }) => (
  <img src="/dexscreener.png" alt="DexScreener" width={size} height={size} style={{ objectFit: "contain", borderRadius: 4 }} />
);

// ============================================================
// UTILITY
// ============================================================
function shortenAddr(addr: string) { return addr.slice(0, 4) + "..." + addr.slice(-4); }
const T = {
  en: {
    subtitle: "SOLANA TOKEN INTELLIGENCE",
    hero: "See through the",
    heroHighlight: "holderbase.",
    heroDesc: "Paste any Solana token address. Get wallet age, activity analysis, bundle detection, cabal pattern scoring, and a plain-English quality verdict in seconds.",
    placeholder: "Paste token mint address...",
    analyze: "Analyze",
    analyzing: "Analyzing...",
    beta: "BETA",
    whyTitle: "Why holderbase quality matters",
    problemTitle: "The problem",
    problemDesc: 'Most tokens look organic on the surface. 500 holders, growing chart, active Telegram. But underneath: <strong style="color: var(--text)">70% are fresh wallets from the same funding source</strong>, bundled in the same slot, holding nothing else. The chart is manufactured. The "community" is one person with 50 wallets.',
    detectTitle: "What we detect",
    detectDesc: 'HolderScope analyzes every wallet individually. <strong style="color: var(--text)">Wallet age, transaction history, SOL balance, token diversity, funding source, buy timing, and bundle patterns.</strong> We compute concentration metrics (Gini, HHI), detect same-slot buys, trace funding clusters, and score the entire holderbase on a 0-100 scale.',
    verdictTitle: "Plain-English verdict",
    verdictDesc: 'No jargon, no ambiguous charts. You get a letter grade (A–F), a numerical score, specific red flags, and a written verdict explaining exactly what the holderbase looks like and why. <strong style="color: var(--accent)">Know before you ape.</strong>',
    sybilTitle: "Sybil / Cabal Detection",
    sybilDesc: "Fresh wallets, single-token holders, same-slot buys, funding cluster analysis. Spots manufactured holderbases.",
    qualityTitle: "Wallet Quality Scoring",
    qualityDesc: "Age, tx count, SOL balance, token diversity. Each wallet profiled individually. Aggregated into holderbase metrics.",
    concTitle: "Concentration Analysis",
    concDesc: "Top 5/10/20 holder dominance, Gini coefficient, HHI index. Detects whale risk and distribution health.",
    howTitle: "How it works",
    step1: "Paste any Solana token mint address",
    step2: "We fetch top 100 holders via Helius DAS and analyze each wallet in parallel",
    step3: "Deep scan runs bundle detection, funding cluster tracing, and buy timing analysis",
    step4: "Get a scored verdict — letter grade, red flags, and plain-English assessment",
    dataSource: "Data source:",
    dataSourceDesc: "Helius RPC (enhanced transactions, DAS). No third-party APIs that can be gamed. All analysis runs on raw on-chain data.",
    rugcheck: "❌ Rugcheck",
    rugcheckDesc: 'Flags supply concentration and LP locks. Doesn\'t analyze individual wallets, wallet age, or funding sources. <strong style="color: var(--red)">Surface-level only.</strong>',
    bubblemaps: "⚠️ Bubblemaps",
    bubblemapsDesc: 'Shows wallet clusters visually. Useful but no scoring, no age analysis, no automated verdict. <strong style="color: var(--yellow)">Manual interpretation required.</strong>',
    holderscope: "✓ HolderScope",
    holderscopeDesc: 'Individual wallet profiling, funding trace, bundle detection, buy timing, concentration metrics, and AI-scored verdict. <strong style="color: var(--accent)">Full picture, plain English.</strong>',
    emptyTitle: "Paste a Solana token address above to analyze its holderbase",
    emptySub: "Analysis takes ~15-20 seconds · Top 100 holders · Free to use",
    verdictHeader: "Holderbase Verdict",
    walletsAnalyzed: "wallets analyzed",
    outOf: "out of",
    totalHolders: "total holders",
    top20: "Top 20 Holders",
    allWallets: "All Analyzed Wallets",
    deepScanTitle: "DEEP SCAN RESULTS",
    deepScanLoading: "Running deep scan...",
    deepScanSub: "Analyzing bundles, funding sources, and buy patterns",
    countingHolders: "Counting holders...",
    genVerdict: "Generating verdict...",
    fetchingHolders: "Fetching top",
    holders: "holders...",
    footer: "know before you ape",
    footerData: "Data sourced from Helius RPC · Wallet ages from first on-chain transaction · Top 100 holders analyzed · Results are indicative, not definitive",
    freshWallets: "Fresh Wallets (<7d)",
    under24h: "under 24hrs",
    veteranHolders: "Veteran Holders (90d+)",
    og180: "OG (180d+)",
    lowActivity: "Low Activity (<10 txs)",
    likelyBurner: "likely burner wallets",
    singleToken: "Single-Token Holders",
    onlyHoldThis: "only hold this token",
    avgWalletAge: "Avg Wallet Age",
    median: "median",
    avgTxCount: "Avg Tx Count",
    lifetimeTx: "lifetime transactions",
    avgSolBal: "Avg SOL Balance",
    solPerWallet: "SOL per wallet",
    diamondHands: "Diamond Hands (>2d)",
    holding2d: "holding for 2+ days",
    walletAgeDist: "Wallet Age Distribution",
    holdDurDist: "Hold Duration Distribution",
    radar: "Holderbase Radar",
    tokenConc: "Token Concentration",
    buyTimeline: "Buy Timeline",
    solBalDist: "SOL Balance Distribution",
    walletScatter: "Wallet Scatter (Age vs Holdings)",
    mcap: "MCap", vol24: "24h Vol", liquidity: "Liquidity", holdersLabel: "Holders", dex: "DEX",
  },
  zh: {
    subtitle: "SOLANA 代币情报",
    hero: "看透",
    heroHighlight: "持币结构。",
    heroDesc: "粘贴任意 Solana 代币地址，即刻获取钱包年龄、活跃度分析、捆绑检测、庄家模式评分和中文质量评估。",
    placeholder: "粘贴代币地址...",
    analyze: "分析",
    analyzing: "分析中...",
    beta: "测试版",
    whyTitle: "为什么持币质量很重要",
    problemTitle: "问题所在",
    problemDesc: '大多数代币表面看起来很正常——500个持有者、上涨的图表、活跃的电报群。但实际上：<strong style="color: var(--text)">70%是来自同一资金来源的新钱包</strong>，在同一个区块买入，只持有这一个代币。图表是人为制造的，"社区"不过是一个人操控的50个钱包。',
    detectTitle: "我们检测什么",
    detectDesc: 'HolderScope 逐个分析每个钱包。<strong style="color: var(--text)">钱包年龄、交易历史、SOL余额、代币多样性、资金来源、买入时间和捆绑模式。</strong>计算集中度指标（基尼系数、HHI），检测同区块买入，追踪资金集群，对整个持币基础进行0-100评分。',
    verdictTitle: "中文评估报告",
    verdictDesc: '没有行话，没有模糊的图表。你会得到一个字母等级（A–F）、一个数字分数、具体的危险信号，以及一份详细解释持币结构的评估报告。<strong style="color: var(--accent)">入场前先了解。</strong>',
    sybilTitle: "女巫 / 庄家检测",
    sybilDesc: "新钱包、单币持有者、同区块买入、资金集群分析。识别人为制造的持币结构。",
    qualityTitle: "钱包质量评分",
    qualityDesc: "年龄、交易数、SOL余额、代币多样性。逐个分析每个钱包，汇总为持币基础指标。",
    concTitle: "集中度分析",
    concDesc: "Top 5/10/20 持有者占比、基尼系数、HHI指数。检测鲸鱼风险和分配健康度。",
    howTitle: "工作原理",
    step1: "粘贴任意 Solana 代币地址",
    step2: "通过 Helius DAS 获取前100名持有者，并行分析每个钱包",
    step3: "深度扫描运行捆绑检测、资金集群追踪和买入时间分析",
    step4: "获得评分报告——字母等级、危险信号和中文评估",
    dataSource: "数据来源：",
    dataSourceDesc: "Helius RPC（增强交易、DAS）。无第三方API。所有分析基于原始链上数据。",
    rugcheck: "❌ Rugcheck",
    rugcheckDesc: '标记供应集中度和LP锁定。不分析单个钱包、钱包年龄或资金来源。<strong style="color: var(--red)">仅表面层级。</strong>',
    bubblemaps: "⚠️ Bubblemaps",
    bubblemapsDesc: '可视化钱包集群。有用但无评分、无年龄分析、无自动评估。<strong style="color: var(--yellow)">需人工解读。</strong>',
    holderscope: "✓ HolderScope",
    holderscopeDesc: '单个钱包分析、资金追踪、捆绑检测、买入时间、集中度指标和AI评分。<strong style="color: var(--accent)">全景分析，中文报告。</strong>',
    emptyTitle: "在上方粘贴 Solana 代币地址以分析其持币结构",
    emptySub: "分析耗时约15-20秒 · 前100名持有者 · 免费使用",
    verdictHeader: "持币基础评估",
    walletsAnalyzed: "个钱包已分析",
    outOf: "共",
    totalHolders: "个持有者",
    top20: "前20名持有者",
    allWallets: "全部已分析钱包",
    deepScanTitle: "深度扫描结果",
    deepScanLoading: "正在深度扫描...",
    deepScanSub: "分析捆绑、资金来源和买入模式",
    countingHolders: "正在统计持有者...",
    genVerdict: "正在生成评估...",
    fetchingHolders: "正在获取前",
    holders: "名持有者...",
    footer: "入场前先了解",
    footerData: "数据来源：Helius RPC · 钱包年龄基于首笔链上交易 · 前100名持有者 · 结果仅供参考",
    freshWallets: "新钱包 (<7天)",
    under24h: "24小时内",
    veteranHolders: "老持有者 (90天+)",
    og180: "元老 (180天+)",
    lowActivity: "低活跃 (<10笔)",
    likelyBurner: "可能是一次性钱包",
    singleToken: "单币持有者",
    onlyHoldThis: "仅持有此代币",
    avgWalletAge: "平均钱包年龄",
    median: "中位数",
    avgTxCount: "平均交易数",
    lifetimeTx: "历史总交易",
    avgSolBal: "平均SOL余额",
    solPerWallet: "每钱包SOL",
    diamondHands: "钻石手 (>2天)",
    holding2d: "持有超过2天",
    walletAgeDist: "钱包年龄分布",
    holdDurDist: "持有时长分布",
    radar: "持币雷达图",
    tokenConc: "代币集中度",
    buyTimeline: "买入时间线",
    solBalDist: "SOL余额分布",
    walletScatter: "钱包散点图（年龄 vs 持仓）",
    mcap: "市值", vol24: "24h成交量", liquidity: "流动性", holdersLabel: "持有者", dex: "DEX",
  },
};

function gradeColor(g: string) { return g === "A" ? "text-emerald-600" : g === "B" ? "text-violet-600" : g === "C" ? "text-yellow-600" : g === "D" ? "text-orange-600" : "text-red-600"; }
function scoreColor(s: number) { return s >= 80 ? "bg-emerald-500" : s >= 65 ? "bg-violet-500" : s >= 50 ? "bg-yellow-500" : s >= 35 ? "bg-orange-500" : "bg-red-500"; }
function scoreBorderColor(s: number) { return s >= 80 ? "border-emerald-500/30" : s >= 65 ? "border-violet-500/30" : s >= 50 ? "border-yellow-500/30" : s >= 35 ? "border-orange-500/30" : "border-red-500/30"; }

// ============================================================
// SPARKLINE + TOKEN CARD
// ============================================================
function Sparkline({ data, width = 120, height = 40, color }: { data: number[]; width?: number; height?: number; color?: string }) {
  if (!data.length || data.length < 2) return null;
  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;
  const lineColor = color || (data[data.length - 1] >= data[0] ? "var(--green)" : "var(--red)");
  const points = data.map((v, i) => {
    const x = (i / (data.length - 1)) * width;
    const y = height - ((v - min) / range) * (height - 4) - 2;
    return `${x},${y}`;
  }).join(" ");
  const fillPoints = `0,${height} ${points} ${width},${height}`;
  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} style={{ display: "block" }}>
      <defs>
        <linearGradient id="spark-fill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={lineColor} stopOpacity="0.15" />
          <stop offset="100%" stopColor={lineColor} stopOpacity="0" />
        </linearGradient>
      </defs>
      <polygon points={fillPoints} fill="url(#spark-fill)" />
      <polyline points={points} fill="none" stroke={lineColor} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function TokenCard({ info, labels }: { info: TokenInfo; labels: { mcap: string; vol24: string; liquidity: string; holdersLabel: string; dex: string } }) {
  const fmt = (n: number | null, prefix = "$") => {
    if (n === null) return "—";
    if (n >= 1e9) return `${prefix}${(n / 1e9).toFixed(2)}B`;
    if (n >= 1e6) return `${prefix}${(n / 1e6).toFixed(2)}M`;
    if (n >= 1e3) return `${prefix}${(n / 1e3).toFixed(1)}K`;
    return `${prefix}${n.toFixed(2)}`;
  };
  const pctColor = (v: number | null) => !v ? "var(--text-muted)" : v > 0 ? "var(--green)" : "var(--red)";
  const pctStr = (v: number | null) => v === null ? "—" : `${v > 0 ? "+" : ""}${v.toFixed(1)}%`;

  return (
    <div className="glass" style={{ borderRadius: "20px", overflow: "hidden" }}>
      <div style={{ padding: "20px 24px", display: "flex", gap: "20px", alignItems: "center" }}>
        {/* Token image */}
        {info.image ? (
          <img src={info.image} alt={info.symbol} style={{ width: 56, height: 56, borderRadius: "14px", objectFit: "cover", border: "2px solid var(--border)", flexShrink: 0 }} />
        ) : (
          <div style={{ width: 56, height: 56, borderRadius: "14px", background: "var(--bg-card-alt)", border: "2px solid var(--border)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "20px", flexShrink: 0 }}>🪙</div>
        )}

        {/* Name + price */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "baseline", gap: "8px", marginBottom: "4px" }}>
            <span style={{ fontSize: "20px", fontWeight: 800, color: "var(--text)" }}>${info.symbol}</span>
            <span style={{ fontSize: "13px", color: "var(--text-muted)" }}>{info.name}</span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "12px", flexWrap: "wrap" }}>
            {info.price !== null && (
              <span className="font-mono" style={{ fontSize: "16px", fontWeight: 700, color: "var(--text)" }}>
                ${info.price < 0.01 ? info.price.toExponential(2) : info.price.toFixed(4)}
              </span>
            )}
            {info.priceChange.h24 !== null && (
              <span className="font-mono" style={{ fontSize: "12px", fontWeight: 600, color: pctColor(info.priceChange.h24) }}>
                {pctStr(info.priceChange.h24)} 24h
              </span>
            )}
          </div>
        </div>

        {/* Sparkline */}
        {info.sparkline.length > 2 && (
          <div style={{ flexShrink: 0 }}>
            <Sparkline data={info.sparkline} width={140} height={48} />
          </div>
        )}
      </div>

      {/* Stats row */}
      <div style={{ padding: "0 24px 16px", display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: "8px" }}>
        {[
          { label: labels.mcap, value: fmt(info.mcap) },
          { label: labels.vol24, value: fmt(info.volume24h) },
          { label: labels.liquidity, value: fmt(info.liquidity) },
          { label: labels.holdersLabel, value: info.holderCount ? info.holderCount.toLocaleString() : "—" },
          { label: labels.dex, value: info.dexId || "—" },
        ].map(s => (
          <div key={s.label} style={{ textAlign: "center", padding: "8px", borderRadius: "10px", background: "var(--bg-card-alt)", border: "1px solid var(--border)" }}>
            <div className="font-mono" style={{ fontSize: "8px", textTransform: "uppercase", letterSpacing: "0.1em", color: "var(--text-muted)", marginBottom: "2px" }}>{s.label}</div>
            <div className="font-mono" style={{ fontSize: "13px", fontWeight: 700, color: "var(--text)" }}>{s.value}</div>
          </div>
        ))}
      </div>

      {/* Price changes */}
      <div style={{ padding: "0 24px 16px", display: "flex", gap: "8px" }}>
        {[
          { label: "5m", value: info.priceChange.m5 },
          { label: "1h", value: info.priceChange.h1 },
          { label: "6h", value: info.priceChange.h6 },
          { label: "24h", value: info.priceChange.h24 },
        ].map(p => (
          <div key={p.label} className="font-mono" style={{ flex: 1, textAlign: "center", padding: "6px", borderRadius: "8px", background: "var(--bg-card-alt)", border: "1px solid var(--border)", fontSize: "11px" }}>
            <span style={{ color: "var(--text-muted)" }}>{p.label} </span>
            <span style={{ fontWeight: 700, color: pctColor(p.value) }}>{pctStr(p.value)}</span>
          </div>
        ))}
      </div>

      {/* Links */}
      {(info.website || info.twitter || info.pairAddress) && (
        <div style={{ padding: "0 24px 16px", display: "flex", gap: "8px" }}>
          {info.pairAddress && (
            <a href={`https://dexscreener.com/solana/${info.pairAddress}`} target="_blank" rel="noopener" style={{ fontSize: "11px", color: "var(--accent-dark)", textDecoration: "none" }}>DexScreener ↗</a>
          )}
          {info.website && (
            <a href={info.website} target="_blank" rel="noopener" style={{ fontSize: "11px", color: "var(--accent-dark)", textDecoration: "none" }}>Website ↗</a>
          )}
          {info.twitter && (
            <a href={info.twitter} target="_blank" rel="noopener" style={{ fontSize: "11px", color: "var(--accent-dark)", textDecoration: "none" }}>Twitter ↗</a>
          )}
        </div>
      )}
    </div>
  );
}

// ============================================================
// SUB-COMPONENTS
// ============================================================
function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button onClick={() => { navigator.clipboard.writeText(text); setCopied(true); setTimeout(() => setCopied(false), 2000); }}
      className="font-mono inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs border transition-all"
      style={{ background: copied ? "rgba(153,69,255,0.1)" : "var(--bg-card-alt)", borderColor: copied ? "var(--accent)" : "var(--border)", color: copied ? "var(--accent)" : "var(--text-muted)" }}>
      {text} {copied ? "✓" : "⧉"}
    </button>
  );
}

function BarChart({ data, color = "bg-cyan-500" }: { data: DistBucket[]; color?: string }) {
  const max = Math.max(...data.map(d => d.pct), 1);
  return (
    <div className="space-y-1.5">
      {data.map(d => (
        <div key={d.label} className="flex items-center gap-2 text-xs">
          <span className="w-24 text-right shrink-0" style={{ color: "var(--text-muted)" }}>{d.label}</span>
          <div className="flex-1 h-5 rounded overflow-hidden" style={{ background: "rgba(153,69,255,0.04)" }}>
            <div className={`h-full ${color} rounded transition-all duration-500`} style={{ width: `${(d.pct / max) * 100}%` }} />
          </div>
          <span className="w-16 shrink-0" style={{ color: "var(--text-secondary)" }}>{d.pct}% ({d.count})</span>
        </div>
      ))}
    </div>
  );
}

function MetricCard({ label, value, sub, warn }: { label: string; value: string; sub?: string; warn?: boolean }) {
  return (
    <div className="glass-alt" style={{ borderRadius: "12px", padding: "14px", borderColor: warn ? "rgba(239,68,68,0.3) !important" : undefined }}>
      <div className="font-mono" style={{ fontSize: "9px", textTransform: "uppercase", letterSpacing: "0.1em", color: "var(--text-muted)", marginBottom: "4px" }}>{label}</div>
      <div className="font-mono" style={{ fontSize: "22px", fontWeight: 700, color: warn ? "var(--red)" : "var(--text)", lineHeight: 1 }}>{value}</div>
      {sub && <div style={{ fontSize: "11px", color: "var(--text-muted)", marginTop: "4px" }}>{sub}</div>}
    </div>
  );
}

// ============================================================
// DEEP SCAN VIZ
// ============================================================
function ConcentrationBar({ concentration }: { concentration: DeepScanResult["concentration"] }) {
  const rest = Math.max(0, 100 - concentration.top20Pct);
  const top5 = concentration.top5Pct;
  const top10Only = concentration.top10Pct - concentration.top5Pct;
  const top20Only = concentration.top20Pct - concentration.top10Pct;
  return (
    <div className="glass-alt" style={{ borderRadius: "14px", padding: "16px" }}>
      <div style={{ fontSize: "13px", fontWeight: 700, color: "var(--text-secondary)", marginBottom: "12px" }}>Token Concentration</div>
      <div style={{ height: "32px", borderRadius: "8px", overflow: "hidden", display: "flex" }}>
        {top5 > 0 && <div className="group relative" style={{ width: `${top5}%`, background: "var(--red)", height: "100%" }}><span className="absolute inset-0 flex items-center justify-center text-[10px] font-bold text-black opacity-0 group-hover:opacity-100">Top 5: {top5.toFixed(1)}%</span></div>}
        {top10Only > 0 && <div style={{ width: `${top10Only}%`, background: "var(--yellow)", height: "100%" }} />}
        {top20Only > 0 && <div style={{ width: `${top20Only}%`, background: "var(--accent)", height: "100%" }} />}
        {rest > 0 && <div style={{ width: `${rest}%`, background: "rgba(153,69,255,0.05)", height: "100%" }} />}
      </div>
      <div style={{ display: "flex", gap: "16px", marginTop: "8px", fontSize: "10px", color: "var(--text-muted)" }}>
        <span>🔴 Top 5 ({top5.toFixed(1)}%)</span>
        <span>🟡 Top 10 ({concentration.top10Pct.toFixed(1)}%)</span>
        <span>🔵 Top 20 ({concentration.top20Pct.toFixed(1)}%)</span>
      </div>
      <div style={{ display: "flex", gap: "24px", marginTop: "6px", fontSize: "11px", color: "var(--text-muted)" }}>
        <span>Gini: <span className="font-mono" style={{ color: concentration.giniCoefficient > 0.8 ? "var(--red)" : concentration.giniCoefficient > 0.6 ? "var(--yellow)" : "var(--green)" }}>{concentration.giniCoefficient.toFixed(3)}</span></span>
        <span>HHI: <span className="font-mono" style={{ color: "var(--text-secondary)" }}>{concentration.herfindahlIndex.toFixed(4)}</span></span>
      </div>
    </div>
  );
}

function BundleDetection({ bundles, bundleCount, bundledWalletCount }: { bundles: DeepScanResult["bundles"]; bundleCount: number; bundledWalletCount: number }) {
  const [expanded, setExpanded] = useState<Record<number, boolean>>({});
  if (bundleCount === 0) return null;
  return (
    <div style={{ background: "rgba(239,68,68,0.04)", border: "1px solid rgba(239,68,68,0.2)", borderRadius: "14px", padding: "16px" }}>
      <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "12px" }}>
        <AlertIcon size={18} color="var(--red)" />
        <span style={{ fontSize: "13px", fontWeight: 700, color: "var(--red)" }}>Bundle Detection: {bundleCount} bundles ({bundledWalletCount} wallets)</span>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
        {bundles.map((b, i) => (
          <div key={i} style={{ background: "rgba(153,69,255,0.04)", borderRadius: "10px", padding: "12px" }}>
            <button onClick={() => setExpanded(p => ({ ...p, [i]: !p[i] }))} style={{ width: "100%", display: "flex", alignItems: "center", gap: "12px", fontSize: "11px", textAlign: "left", background: "none", border: "none", color: "var(--text-secondary)", cursor: "pointer" }}>
              <span style={{ color: "var(--text-muted)" }}>{expanded[i] ? "▼" : "▶"}</span>
              <span>Slot {b.slot.toLocaleString()}</span>
              <span style={{ color: "var(--text-muted)" }}>·</span>
              <span style={{ color: "var(--text-muted)" }}>{new Date(b.timestamp * 1000).toLocaleString()}</span>
              <span style={{ color: "var(--text-muted)" }}>·</span>
              <span style={{ color: "var(--red)", fontWeight: 700 }}>{b.wallets.length} wallets</span>
            </button>
            {expanded[i] && (
              <div style={{ marginTop: "8px", paddingLeft: "20px", display: "flex", flexDirection: "column", gap: "2px" }}>
                {b.wallets.map(w => (
                  <a key={w} href={`https://solscan.io/account/${w}`} target="_blank" rel="noopener" className="font-mono" style={{ fontSize: "11px", color: "var(--accent-dark)", textDecoration: "none" }}>{shortenAddr(w)}</a>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

function FundingClusters({ clusters, clusterCount, clusteredWalletCount }: { clusters: DeepScanResult["fundingClusters"]; clusterCount: number; clusteredWalletCount: number }) {
  if (clusterCount === 0) return null;
  return (
    <div style={{ background: "rgba(239,68,68,0.04)", border: "1px solid rgba(239,68,68,0.2)", borderRadius: "14px", padding: "16px" }}>
      <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "12px" }}>
        <span style={{ fontSize: "16px" }}>🕸️</span>
        <span style={{ fontSize: "13px", fontWeight: 700, color: "var(--red)" }}>{clusteredWalletCount} wallets funded by same source ({clusterCount} clusters)</span>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
        {clusters.map((c, i) => (
          <div key={i} style={{ background: "rgba(153,69,255,0.04)", borderRadius: "10px", padding: "12px", border: c.count >= 3 ? "1px solid rgba(239,68,68,0.3)" : "none" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "11px", marginBottom: "6px" }}>
              {c.count >= 3 && <span style={{ color: "var(--red)", fontSize: "10px", fontWeight: 700, background: "rgba(239,68,68,0.1)", padding: "2px 6px", borderRadius: "4px" }}>RED FLAG</span>}
              <a href={`https://solscan.io/account/${c.funder}`} target="_blank" rel="noopener" className="font-mono" style={{ color: "var(--yellow)", textDecoration: "none" }}>{shortenAddr(c.funder)}</a>
              <span style={{ color: "var(--text-muted)" }}>→ {c.count} wallets</span>
            </div>
            <div style={{ paddingLeft: "16px", display: "flex", flexDirection: "column", gap: "2px" }}>
              {c.wallets.map(w => (
                <a key={w} href={`https://solscan.io/account/${w}`} target="_blank" rel="noopener" className="font-mono" style={{ fontSize: "11px", color: "var(--accent-dark)", textDecoration: "none" }}>└ {shortenAddr(w)}</a>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function BuyTimeline({ timeline }: { timeline: DeepScanResult["buyTimeline"] }) {
  if (!timeline.length) return null;
  const maxMin = Math.max(...timeline.map(t => t.minutesAfterFirst), 1);
  return (
    <div className="glass-alt" style={{ borderRadius: "14px", padding: "16px" }}>
      <div style={{ fontSize: "13px", fontWeight: 700, color: "var(--text-secondary)", marginBottom: "12px" }}>Buy Timeline</div>
      <div style={{ position: "relative", height: "64px", background: "rgba(153,69,255,0.04)", borderRadius: "8px", overflow: "hidden" }}>
        {timeline.map((t, i) => {
          const left = (t.minutesAfterFirst / maxMin) * 100;
          const bg = t.minutesAfterFirst < 5 ? "var(--red)" : t.minutesAfterFirst < 60 ? "var(--yellow)" : "var(--green)";
          return <div key={i} style={{ position: "absolute", top: "50%", left: `${Math.min(left, 99)}%`, transform: "translate(-50%, -50%)", width: 10, height: 10, borderRadius: "50%", background: bg, opacity: 0.8, cursor: "pointer" }} title={`${shortenAddr(t.wallet)} — ${t.minutesAfterFirst.toFixed(1)}m after first buy`} />;
        })}
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: "10px", color: "var(--text-muted)", marginTop: "4px" }}>
        <span>0 min</span><span>{maxMin.toFixed(0)} min</span>
      </div>
      <div style={{ display: "flex", gap: "16px", marginTop: "8px", fontSize: "10px", color: "var(--text-muted)" }}>
        <span>🔴 &lt;5 min (insider risk)</span>
        <span>🟡 &lt;60 min</span>
        <span>🟢 60+ min</span>
      </div>
    </div>
  );
}

function SolDistChart({ dist }: { dist: DeepScanResult["solDistribution"] }) {
  const buckets: DistBucket[] = [
    { label: "Dust (<0.1)", count: dist.dust, pct: 0 },
    { label: "Low (0.1-1)", count: dist.low, pct: 0 },
    { label: "Med (1-10)", count: dist.medium, pct: 0 },
    { label: "High (10-100)", count: dist.high, pct: 0 },
    { label: "Whale (100+)", count: dist.whale, pct: 0 },
  ];
  const total = buckets.reduce((s, b) => s + b.count, 0) || 1;
  buckets.forEach(b => (b.pct = Math.round((b.count / total) * 1000) / 10));
  const colors = ["bg-red-500", "bg-orange-500", "bg-yellow-500", "bg-cyan-500", "bg-emerald-500"];
  const max = Math.max(...buckets.map(b => b.pct), 1);
  return (
    <div className="glass-alt" style={{ borderRadius: "14px", padding: "16px" }}>
      <div style={{ fontSize: "13px", fontWeight: 700, color: "var(--text-secondary)", marginBottom: "12px" }}>SOL Balance Distribution</div>
      <div className="space-y-1.5">
        {buckets.map((d, i) => (
          <div key={d.label} className="flex items-center gap-2 text-xs">
            <span className="w-24 text-right shrink-0" style={{ color: "var(--text-muted)" }}>{d.label}</span>
            <div className="flex-1 h-5 rounded overflow-hidden" style={{ background: "rgba(153,69,255,0.04)" }}>
              <div className={`h-full ${colors[i]} rounded`} style={{ width: `${(d.pct / max) * 100}%` }} />
            </div>
            <span className="w-16 shrink-0" style={{ color: "var(--text-secondary)" }}>{d.pct}% ({d.count})</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function RadarChart({ metrics }: { metrics: AnalysisResult["metrics"] }) {
  const axes = [
    { label: "Age", value: Math.min(100, (metrics.avgWalletAgeDays / 365) * 100) },
    { label: "Activity", value: Math.min(100, (metrics.avgTxCount / 1000) * 100) },
    { label: "Diversity", value: 100 - metrics.singleTokenPct },
    { label: "Balance", value: Math.min(100, (metrics.avgSolBalance / 10) * 100) },
    { label: "Organic", value: 100 - metrics.freshWalletPct },
    { label: "Conviction", value: metrics.diamondHandsPct },
  ];
  const cx = 150, cy = 150, r = 100;
  const step = (2 * Math.PI) / 6, start = -Math.PI / 2;
  const pt = (i: number, pct: number) => ({ x: cx + (r * pct / 100) * Math.cos(start + i * step), y: cy + (r * pct / 100) * Math.sin(start + i * step) });
  const valPts = axes.map((a, i) => pt(i, a.value)).map(p => `${p.x},${p.y}`).join(" ");
  return (
    <div className="glass-alt" style={{ borderRadius: "14px", padding: "16px" }}>
      <div style={{ fontSize: "13px", fontWeight: 700, color: "var(--text-secondary)", marginBottom: "12px" }}>Holderbase Radar</div>
      <div style={{ display: "flex", justifyContent: "center" }}>
        <svg viewBox="0 0 300 300" style={{ width: 256, height: 256 }}>
          {[25, 50, 75, 100].map(p => <polygon key={p} points={Array.from({ length: 6 }, (_, i) => pt(i, p)).map(p => `${p.x},${p.y}`).join(" ")} fill="none" stroke="#9945FF" strokeOpacity={0.1} />)}
          {Array.from({ length: 6 }, (_, i) => { const p = pt(i, 100); return <line key={i} x1={cx} y1={cy} x2={p.x} y2={p.y} stroke="#9945FF" strokeOpacity={0.1} />; })}
          <polygon points={valPts} fill="rgba(153,69,255,0.12)" stroke="#9945FF" strokeWidth={2} />
          {axes.map((a, i) => { const p = pt(i, a.value); return <circle key={i} cx={p.x} cy={p.y} r={3} fill="#9945FF" />; })}
          {axes.map((a, i) => { const p = pt(i, 125); return <text key={i} x={p.x} y={p.y} textAnchor="middle" dominantBaseline="middle" fill="#4a4a6a" fontSize={10}>{a.label}</text>; })}
        </svg>
      </div>
    </div>
  );
}

function BubbleScatter({ wallets, totalSupply }: { wallets: WalletAnalysis[]; totalSupply: number }) {
  if (!wallets.length) return null;
  const maxAge = Math.max(...wallets.map(w => w.walletAgeDays), 1);
  const logMax = Math.log10(maxAge + 1);
  const maxPct = Math.max(...wallets.map(w => totalSupply > 0 ? (w.balance / totalSupply) * 100 : 0), 0.1);

  // Render as SVG for clean scaling
  const W = 600, H = 300, PAD = 40;
  const plotW = W - PAD * 2, plotH = H - PAD * 2;

  return (
    <div className="glass-alt" style={{ borderRadius: "14px", padding: "16px" }}>
      <div style={{ fontSize: "13px", fontWeight: 700, color: "var(--text-secondary)", marginBottom: "12px" }}>Wallet Scatter (Age vs Holdings)</div>
      <svg viewBox={`0 0 ${W} ${H}`} style={{ width: "100%", height: "auto", display: "block" }}>
        {/* Grid lines */}
        {[0, 0.25, 0.5, 0.75, 1].map(p => (
          <line key={`h${p}`} x1={PAD} y1={PAD + plotH * (1 - p)} x2={PAD + plotW} y2={PAD + plotH * (1 - p)} stroke="#9945FF" strokeOpacity={0.08} />
        ))}
        {[0, 0.25, 0.5, 0.75, 1].map(p => (
          <line key={`v${p}`} x1={PAD + plotW * p} y1={PAD} x2={PAD + plotW * p} y2={PAD + plotH} stroke="#9945FF" strokeOpacity={0.08} />
        ))}
        {/* Axes */}
        <line x1={PAD} y1={PAD + plotH} x2={PAD + plotW} y2={PAD + plotH} stroke="#9945FF" strokeOpacity={0.2} />
        <line x1={PAD} y1={PAD} x2={PAD} y2={PAD + plotH} stroke="#9945FF" strokeOpacity={0.2} />
        {/* Dots */}
        {wallets.map(w => {
          const xNorm = logMax > 0 ? Math.log10(w.walletAgeDays + 1) / logMax : 0;
          const yNorm = totalSupply > 0 ? Math.min((w.balance / totalSupply) * 100 / maxPct, 1) : 0;
          const cx = PAD + xNorm * plotW;
          const cy = PAD + plotH - yNorm * plotH;
          const r = Math.max(3, Math.min(Math.sqrt(w.totalTxCount) * 0.8, 16));
          const fill = w.walletAgeDays < 7 ? "#ef4444" : w.walletAgeDays >= 180 ? "#14F195" : "#9945FF";
          return <circle key={w.address} cx={cx} cy={cy} r={r} fill={fill} fillOpacity={0.6} stroke={fill} strokeOpacity={0.3} strokeWidth={1}>
            <title>{`${shortenAddr(w.address)} — Age: ${w.walletAgeDays.toFixed(0)}d | ${(w.balance / (totalSupply || 1) * 100).toFixed(2)}% | Txs: ${w.totalTxCount}`}</title>
          </circle>;
        })}
        {/* Axis labels */}
        <text x={PAD} y={H - 4} fill="#8888a8" fontSize={10}>0d</text>
        <text x={PAD + plotW} y={H - 4} fill="#8888a8" fontSize={10} textAnchor="end">{maxAge.toFixed(0)}d</text>
        <text x={PAD + plotW / 2} y={H - 4} fill="#8888a8" fontSize={9} textAnchor="middle">wallet age →</text>
        <text x={8} y={PAD + plotH / 2} fill="#8888a8" fontSize={9} textAnchor="middle" transform={`rotate(-90, 8, ${PAD + plotH / 2})`}>holdings % →</text>
      </svg>
      <div style={{ display: "flex", gap: "16px", marginTop: "8px", fontSize: "10px", color: "var(--text-muted)", justifyContent: "center" }}>
        <span>🔴 Fresh (&lt;7d)</span>
        <span>🔵 Veteran</span>
        <span>🟢 OG (180d+)</span>
        <span style={{ color: "var(--text-muted)", opacity: 0.5 }}>· dot size = tx count</span>
      </div>
    </div>
  );
}

// ============================================================
// FLOATING BG
// ============================================================
function FloatingBg() {
  return (
    <div style={{ position: "fixed", inset: 0, pointerEvents: "none", zIndex: 0, overflow: "hidden" }}>
      <div style={{ position: "absolute", top: "5%", left: "6%", opacity: 0.04, animation: "float 8s ease-in-out infinite" }}><ShieldIcon size={40} color="var(--accent)" /></div>
      <div style={{ position: "absolute", top: "20%", right: "7%", opacity: 0.03, animation: "float 9s ease-in-out infinite", animationDelay: "1.5s" }}><EyeIcon size={48} color="var(--accent-dark)" /></div>
      <div style={{ position: "absolute", top: "55%", left: "4%", opacity: 0.03, animation: "float 7s ease-in-out infinite", animationDelay: "3s" }}><TargetIcon size={32} color="var(--accent)" /></div>
      <div style={{ position: "absolute", top: "75%", right: "5%", opacity: 0.03, animation: "float 10s ease-in-out infinite", animationDelay: "2s" }}><SearchIcon size={36} color="var(--accent-dark)" /></div>
    </div>
  );
}

// ============================================================
// MAIN PAGE
// ============================================================
export default function Home() {
  const [mint, setMint] = useState("");
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState("");
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [verdict, setVerdict] = useState<Verdict | null>(null);
  const [tokenInfo, setTokenInfo] = useState<TokenInfo | null>(null);
  const [deepScan, setDeepScan] = useState<DeepScanResult | null>(null);
  const [deepScanLoading, setDeepScanLoading] = useState(false);
  const [deepScanError, setDeepScanError] = useState("");
  const [error, setError] = useState("");
  const [showWallets, setShowWallets] = useState(false);
  const [analyzeLimit, setAnalyzeLimit] = useState(20);
  const [darkMode, setDarkMode] = useState(false);
  const [lang, setLang] = useState<"en" | "zh">("en");
  const resultsRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const saved = localStorage.getItem("holderscope-theme");
    const isDark = saved === "dark";
    setDarkMode(isDark);
    document.documentElement.setAttribute("data-theme", isDark ? "dark" : "light");
    const savedLang = localStorage.getItem("holderscope-lang");
    if (savedLang === "zh") setLang("zh");
  }, []);

  const toggleTheme = () => {
    const next = !darkMode;
    setDarkMode(next);
    document.documentElement.setAttribute("data-theme", next ? "dark" : "light");
    localStorage.setItem("holderscope-theme", next ? "dark" : "light");
  };

  const analyze = useCallback(async (limit?: number) => {
    const addr = mint.trim();
    if (!addr) return;
    const useLimit = limit || analyzeLimit;
    setLoading(true); setError(""); setResult(null); setVerdict(null); setDeepScan(null); setDeepScanError(""); setProgress(`${t.fetchingHolders} ${useLimit} ${t.holders}`);
    setTokenInfo(null);

    try {
      // Fetch token info in parallel with analysis — always fetch fresh
      const [res, infoRes] = await Promise.all([
        fetch("/api/analyze", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ mint: addr, limit: useLimit }) }),
        fetch("/api/token-info", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ mint: addr }) }),
      ]);

      if (infoRes.ok) {
        const infoData = await infoRes.json();
        setTokenInfo(infoData);
      }

      if (!res.ok) { const err = await res.json(); throw new Error(err.error || "Analysis failed"); }
      const data: AnalysisResult = await res.json();
      setResult(data);
      setProgress(t.countingHolders);

      // Get accurate holder count before verdict
      let realHolderCount = data.totalHolders;
      try {
        const hcRes = await fetch("/api/holder-count", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ mint: addr }) });
        if (hcRes.ok) {
          const hcData = await hcRes.json();
          if (hcData?.holderCount) {
            realHolderCount = hcData.holderCount;
            setTokenInfo(prev => prev ? { ...prev, holderCount: realHolderCount } : prev);
            setResult(prev => prev ? { ...prev, totalHolders: realHolderCount } : prev);
          }
        }
      } catch { /* use analyze count */ }

      setProgress(t.genVerdict);
      const vRes = await fetch("/api/ai-verdict", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ metrics: data.metrics, totalHolders: realHolderCount, analyzedHolders: data.analyzedHolders, tokenSymbol: data.tokenSymbol }) });
      if (vRes.ok) setVerdict(await vRes.json());

      setLoading(false); setProgress("");

      // Deep scan
      setDeepScanLoading(true);
      try {
        const dsRes = await fetch("/api/deep-scan", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ mint: data.mint, wallets: data.wallets, totalSupply: data.totalSupply }) });
        if (dsRes.ok) setDeepScan(await dsRes.json());
        else setDeepScanError("Deep scan incomplete");
      } catch { setDeepScanError("Deep scan incomplete"); }
      finally { setDeepScanLoading(false); }

      setTimeout(() => resultsRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 100);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
      setLoading(false); setProgress("");
    }
  }, [mint, analyzeLimit]);

  const totalSupply = result ? result.totalSupply : 0;
  const t = T[lang];

  // Scroll-triggered reveals
  useEffect(() => {
    const loadGsap = async () => {
      try {
        const gsap = (await import("gsap")).default;
        const { ScrollTrigger } = await import("gsap/ScrollTrigger");
        gsap.registerPlugin(ScrollTrigger);
        gsap.config({ force3D: true });
        document.querySelectorAll(".reveal").forEach(el => {
          const h = el as HTMLElement;
          h.style.willChange = "transform, opacity";
          gsap.fromTo(h, { opacity: 0, y: 24 }, {
            opacity: 1, y: 0, duration: 0.6, ease: "power3.out",
            scrollTrigger: { trigger: h, start: "top 90%", once: true },
            onComplete: () => { h.style.willChange = "auto"; },
          });
        });
        document.querySelectorAll(".stagger").forEach(container => {
          const children = Array.from(container.children) as HTMLElement[];
          gsap.fromTo(children, { opacity: 0, y: 16 }, {
            opacity: 1, y: 0, duration: 0.4, stagger: 0.06, ease: "power3.out",
            scrollTrigger: { trigger: container, start: "top 90%", once: true },
          });
        });
      } catch { /* gsap optional */ }
    };
    loadGsap();
  }, []);

  return (
    <div style={{ minHeight: "100vh", position: "relative" }}>
      <FloatingBg />

      <div style={{ position: "relative", zIndex: 10, maxWidth: "1100px", margin: "0 auto", padding: "0 32px" }}>

        {/* ═══ NAV ═══ */}
        <div className="glass" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 24px", borderRadius: "16px", marginTop: "16px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
            <button onClick={() => { setResult(null); setVerdict(null); setDeepScan(null); setTokenInfo(null); setMint(""); setError(""); setDeepScanError(""); }} style={{ display: "flex", alignItems: "center", gap: "8px", background: "none", border: "none", cursor: "pointer", padding: 0 }}>
              <img src="/logo.png" alt="HolderScope" width={28} height={28} style={{ objectFit: "contain" }} />
              <span style={{ fontSize: "20px", fontWeight: 800 }}><span style={{ color: "var(--accent)" }}>HOLDER</span><span style={{ color: "var(--text-muted)" }}>SCOPE</span></span>
            </button>
            <span className="font-mono" style={{ fontSize: "10px", fontWeight: 600, padding: "3px 8px", borderRadius: "6px", background: "rgba(153,69,255,0.08)", border: "1px solid var(--border-accent)", color: "var(--accent-dark)" }}>BETA</span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "4px" }}>
            <button onClick={() => { const next = lang === "en" ? "zh" : "en"; setLang(next); localStorage.setItem("holderscope-lang", next); }}
              className="font-mono"
              style={{ display: "flex", alignItems: "center", justifyContent: "center", width: 36, height: 36, borderRadius: "10px", background: "none", border: "none", cursor: "pointer", color: "var(--text-muted)", fontSize: "12px", fontWeight: 700, transition: "all 0.15s" }}
              onMouseEnter={e => { e.currentTarget.style.color = "var(--accent)"; e.currentTarget.style.background = "rgba(153,69,255,0.08)"; }}
              onMouseLeave={e => { e.currentTarget.style.color = "var(--text-muted)"; e.currentTarget.style.background = "transparent"; }}>
              {lang === "en" ? "中文" : "EN"}
            </button>
            <button onClick={toggleTheme} title={darkMode ? "Light mode" : "Dark mode"}
              style={{ display: "flex", alignItems: "center", justifyContent: "center", width: 36, height: 36, borderRadius: "10px", background: "none", border: "none", cursor: "pointer", color: "var(--text-muted)", fontSize: "18px", transition: "all 0.15s" }}
              onMouseEnter={e => { e.currentTarget.style.color = "var(--accent)"; e.currentTarget.style.background = "rgba(153,69,255,0.08)"; }}
              onMouseLeave={e => { e.currentTarget.style.color = "var(--text-muted)"; e.currentTarget.style.background = "transparent"; }}>
              {darkMode ? "☀️" : "🌙"}
            </button>
            <div style={{ width: 1, height: 20, background: "var(--border)", margin: "0 4px" }} />
            <a href="https://pump.fun" target="_blank" rel="noopener" title="Pump.fun"
              style={{ display: "flex", alignItems: "center", justifyContent: "center", width: 36, height: 36, borderRadius: "10px", color: "var(--text-muted)", textDecoration: "none", transition: "all 0.15s" }}
              onMouseEnter={e => { e.currentTarget.style.color = "var(--accent-dark)"; e.currentTarget.style.background = "rgba(153,69,255,0.08)"; }}
              onMouseLeave={e => { e.currentTarget.style.color = "var(--text-muted)"; e.currentTarget.style.background = "transparent"; }}>
              <PumpFunIcon size={20} />
            </a>
            <a href="https://dexscreener.com" target="_blank" rel="noopener" title="DexScreener"
              style={{ display: "flex", alignItems: "center", justifyContent: "center", width: 36, height: 36, borderRadius: "10px", color: "var(--text-muted)", textDecoration: "none", transition: "all 0.15s" }}
              onMouseEnter={e => { e.currentTarget.style.color = "var(--accent-dark)"; e.currentTarget.style.background = "rgba(153,69,255,0.08)"; }}
              onMouseLeave={e => { e.currentTarget.style.color = "var(--text-muted)"; e.currentTarget.style.background = "transparent"; }}>
              <DexScreenerIcon size={20} />
            </a>
            <div style={{ width: 1, height: 20, background: "var(--border)", margin: "0 4px" }} />
            <a href="https://github.com/co-numina" target="_blank" rel="noopener" title="GitHub"
              style={{ display: "flex", alignItems: "center", justifyContent: "center", width: 36, height: 36, borderRadius: "10px", color: "var(--text-muted)", textDecoration: "none", transition: "all 0.15s" }}
              onMouseEnter={e => { e.currentTarget.style.color = "var(--accent-dark)"; e.currentTarget.style.background = "rgba(153,69,255,0.08)"; }}
              onMouseLeave={e => { e.currentTarget.style.color = "var(--text-muted)"; e.currentTarget.style.background = "transparent"; }}>
              <GitHubIcon size={20} />
            </a>
            <a href="https://x.com/latebuild" target="_blank" rel="noopener" title="Twitter"
              style={{ display: "flex", alignItems: "center", justifyContent: "center", width: 36, height: 36, borderRadius: "10px", color: "var(--text-muted)", textDecoration: "none", transition: "all 0.15s" }}
              onMouseEnter={e => { e.currentTarget.style.color = "var(--accent-dark)"; e.currentTarget.style.background = "rgba(153,69,255,0.08)"; }}
              onMouseLeave={e => { e.currentTarget.style.color = "var(--text-muted)"; e.currentTarget.style.background = "transparent"; }}>
              <XIcon size={18} />
            </a>
          </div>
        </div>

        {/* ═══ HERO ═══ */}
        <div style={{ padding: "48px 0 32px", display: "flex", alignItems: "center", justifyContent: "space-between", gap: "40px" }}>
          <div style={{ flex: 1 }}>
            <div className="font-mono" style={{ fontSize: "11px", fontWeight: 600, color: "var(--accent)", letterSpacing: "0.12em", textTransform: "uppercase", marginBottom: "14px" }}>
              {t.subtitle}
            </div>
            <h1 style={{ fontSize: "44px", fontWeight: 800, lineHeight: 1.05, letterSpacing: "-0.03em", color: "var(--text)", marginBottom: "14px" }}>
              {t.hero}{" "}
              <span style={{ background: "linear-gradient(135deg, var(--accent-bright), var(--green))", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>{t.heroHighlight}</span>
            </h1>
            <p style={{ fontSize: "15px", color: "var(--text-secondary)", maxWidth: "540px", lineHeight: 1.7 }}>
              {t.heroDesc}
            </p>
          </div>
          <div style={{ flexShrink: 0 }}>
            <img src="/logo.png" alt="HolderScope" width={160} height={160} style={{ objectFit: "contain", opacity: 0.9, filter: "drop-shadow(0 8px 32px rgba(153,69,255,0.2))" }} />
          </div>
        </div>

        {/* ═══ SEARCH BAR ═══ */}
        <div className="reveal" style={{ marginBottom: "32px" }}>
          <div style={{ display: "flex", gap: "8px" }}>
            <div style={{ flex: 1, position: "relative" }}>
              <SearchIcon size={16} color="var(--text-muted)" />
              <input
                type="text" value={mint} onChange={e => setMint(e.target.value)}
                onKeyDown={e => e.key === "Enter" && !loading && analyze()}
                placeholder={t.placeholder}
                autoComplete="off"
                autoCorrect="off"
                spellCheck={false}
                data-form-type="other"
                className="font-mono"
                style={{
                  width: "100%", background: "rgba(255,255,255,0.5)", backdropFilter: "blur(12px)", WebkitBackdropFilter: "blur(12px)",
                  border: "2px solid rgba(255,255,255,0.5)", borderRadius: "14px",
                  padding: "14px 16px 14px 16px", fontSize: "13px", color: "var(--text)", outline: "none",
                  boxShadow: "0 4px 16px rgba(153,69,255,0.04), inset 0 1px 0 rgba(255,255,255,0.4)",
                }}
                onFocus={e => { e.currentTarget.style.borderColor = "var(--accent-dark)"; }}
                onBlur={e => { e.currentTarget.style.borderColor = "var(--border)"; }}
              />
            </div>
            <button
              onClick={() => analyze()} disabled={loading || !mint.trim()}
              style={{
                padding: "14px 28px", borderRadius: "14px", fontWeight: 700, fontSize: "14px", border: "none", cursor: loading || !mint.trim() ? "default" : "pointer",
                background: loading || !mint.trim() ? "var(--bg-card-alt)" : "linear-gradient(135deg, var(--accent-bright), var(--accent-dark))",
                color: loading || !mint.trim() ? "var(--text-muted)" : "var(--bg)", boxShadow: loading || !mint.trim() ? "none" : "0 4px 16px var(--accent-glow)",
              }}
            >
              {loading ? t.analyzing : t.analyze}
            </button>
          </div>
        </div>

        {/* ═══ THESIS ═══ */}
        {!result && !loading && (
          <>
            <div className="reveal glass" style={{ marginBottom: "24px", borderRadius: "20px", overflow: "hidden" }}>
              <div style={{ padding: "16px 28px", background: "linear-gradient(135deg, var(--accent-dark), var(--accent))", display: "flex", alignItems: "center", gap: "10px" }}>
                <EyeIcon size={20} color="white" />
                <span style={{ fontSize: "15px", fontWeight: 700, color: "white" }}>{t.whyTitle}</span>
              </div>
              <div style={{ padding: "28px", display: "flex", flexDirection: "column", gap: "24px" }}>
                <div>
                  <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "10px" }}>
                    <AlertIcon size={20} color="var(--red)" />
                    <span style={{ fontSize: "16px", fontWeight: 700, color: "var(--text)" }}>{t.problemTitle}</span>
                  </div>
                  <p style={{ fontSize: "14px", lineHeight: 1.7, color: "var(--text-secondary)" }} dangerouslySetInnerHTML={{ __html: t.problemDesc }} />
                </div>
                <div>
                  <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "10px" }}>
                    <TargetIcon size={20} color="var(--accent-dark)" />
                    <span style={{ fontSize: "16px", fontWeight: 700, color: "var(--text)" }}>{t.detectTitle}</span>
                  </div>
                  <p style={{ fontSize: "14px", lineHeight: 1.7, color: "var(--text-secondary)" }} dangerouslySetInnerHTML={{ __html: t.detectDesc }} />
                </div>
                <div style={{ background: "linear-gradient(135deg, rgba(153,69,255,0.05), rgba(8,145,178,0.06))", borderRadius: "14px", padding: "24px", border: "1px solid var(--border-accent)" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "10px" }}>
                    <ShieldIcon size={20} color="var(--accent)" />
                    <span style={{ fontSize: "16px", fontWeight: 700, color: "var(--accent)" }}>{t.verdictTitle}</span>
                  </div>
                  <p style={{ fontSize: "14px", lineHeight: 1.7, color: "var(--text-secondary)" }} dangerouslySetInnerHTML={{ __html: t.verdictDesc }} />
                </div>
              </div>
            </div>

            {/* ═══ WHAT IT DETECTS ═══ */}
            <div className="reveal stagger" style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "12px", marginBottom: "24px" }}>
              {[
                { icon: <TargetIcon size={20} color="var(--red)" />, title: t.sybilTitle, desc: t.sybilDesc },
                { icon: <LayersIcon size={20} color="var(--accent)" />, title: t.qualityTitle, desc: t.qualityDesc },
                { icon: <TrendIcon size={20} color="var(--green)" />, title: t.concTitle, desc: t.concDesc },
              ].map((card, i) => (
                <div key={i} className="glass" style={{
                  padding: "24px", borderRadius: "16px",
                  display: "flex", flexDirection: "column", gap: "12px", transition: "all 0.3s ease",
                }}
                  onMouseEnter={e => { e.currentTarget.style.transform = "translateY(-4px)"; e.currentTarget.style.boxShadow = "0 12px 32px rgba(153,69,255,0.1), inset 0 1px 0 rgba(255,255,255,0.5)"; }}
                  onMouseLeave={e => { e.currentTarget.style.transform = "translateY(0)"; e.currentTarget.style.boxShadow = "var(--glass-shadow), inset 0 1px 0 rgba(255,255,255,0.4)"; }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                    {card.icon}
                    <span style={{ fontSize: "14px", fontWeight: 700, color: "var(--text)" }}>{card.title}</span>
                  </div>
                  <p style={{ fontSize: "12px", color: "var(--text-secondary)", lineHeight: 1.6 }}>{card.desc}</p>
                </div>
              ))}
            </div>

            {/* ═══ HOW IT WORKS ═══ */}
            <div className="reveal glass" style={{ marginBottom: "24px", borderRadius: "20px", padding: "24px 28px" }}>
              <div className="font-mono" style={{ fontSize: "11px", fontWeight: 600, color: "var(--accent)", letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: "16px" }}>
                {t.howTitle}
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                {[
                  { step: "1", text: t.step1 },
                  { step: "2", text: t.step2 },
                  { step: "3", text: t.step3 },
                  { step: "4", text: t.step4 },
                ].map(s => (
                  <div key={s.step} style={{ display: "flex", alignItems: "center", gap: "12px", padding: "12px 16px", borderRadius: "12px", background: "var(--bg-card-alt)", border: "1px solid var(--border)" }}>
                    <span className="font-mono" style={{ fontSize: "11px", fontWeight: 700, color: "var(--accent)", minWidth: "18px" }}>{s.step}</span>
                    <span style={{ fontSize: "13px", color: "var(--text-secondary)" }}>{s.text}</span>
                  </div>
                ))}
              </div>
              <div style={{ marginTop: "14px", padding: "10px 14px", borderRadius: "10px", background: "rgba(153,69,255,0.04)", border: "1px solid var(--border-accent)", fontSize: "12px", color: "var(--text-secondary)", lineHeight: 1.6 }}>
                <strong style={{ color: "var(--accent-dark)" }}>{t.dataSource}</strong> {t.dataSourceDesc}
              </div>
            </div>

            {/* ═══ VS COMPARISON ═══ */}
            <div className="reveal stagger" style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "12px", marginBottom: "24px" }}>
              <div style={{ background: "rgba(239,68,68,0.04)", borderRadius: "14px", padding: "20px", border: "1px solid rgba(239,68,68,0.12)" }}>
                <div style={{ fontSize: "13px", fontWeight: 700, color: "var(--red)", marginBottom: "10px" }}>{t.rugcheck}</div>
                <div style={{ fontSize: "12px", color: "var(--text-secondary)", lineHeight: 1.7 }} dangerouslySetInnerHTML={{ __html: t.rugcheckDesc }} />
              </div>
              <div style={{ background: "rgba(234,179,8,0.04)", borderRadius: "14px", padding: "20px", border: "1px solid rgba(234,179,8,0.12)" }}>
                <div style={{ fontSize: "13px", fontWeight: 700, color: "var(--yellow)", marginBottom: "10px" }}>{t.bubblemaps}</div>
                <div style={{ fontSize: "12px", color: "var(--text-secondary)", lineHeight: 1.7 }} dangerouslySetInnerHTML={{ __html: t.bubblemapsDesc }} />
              </div>
              <div style={{ background: "rgba(153,69,255,0.04)", borderRadius: "14px", padding: "20px", border: "1px solid var(--border-accent)" }}>
                <div style={{ fontSize: "13px", fontWeight: 700, color: "var(--accent)", marginBottom: "10px" }}>{t.holderscope}</div>
                <div style={{ fontSize: "12px", color: "var(--text-secondary)", lineHeight: 1.7 }} dangerouslySetInnerHTML={{ __html: t.holderscopeDesc }} />
              </div>
            </div>

            {/* ═══ EMPTY STATE ═══ */}
            <div style={{ textAlign: "center", padding: "40px 0 60px" }}>
              <div style={{ fontSize: "48px", marginBottom: "12px", opacity: 0.6 }}>🔍</div>
              <div style={{ fontSize: "16px", color: "var(--text-muted)", marginBottom: "6px" }}>{t.emptyTitle}</div>
              <div style={{ fontSize: "13px", color: "var(--text-muted)", opacity: 0.6 }}>{t.emptySub}</div>
            </div>
          </>
        )}

        {/* ═══ LOADING ═══ */}
        {loading && (
          <div style={{ textAlign: "center", padding: "48px 0" }}>
            <div style={{ display: "inline-block", width: 32, height: 32, border: "2px solid rgba(153,69,255,0.2)", borderTopColor: "var(--accent)", borderRadius: "50%", animation: "spin 1s linear infinite", marginBottom: "16px" }} />
            <div style={{ fontSize: "13px", color: "var(--text-secondary)" }}>{progress}</div>
            <div style={{ fontSize: "11px", color: "var(--text-muted)", marginTop: "4px" }}>Analyzing top 100 holders — takes ~15-20 seconds</div>
          </div>
        )}

        {/* ═══ ERROR ═══ */}
        {error && (
          <div style={{ background: "rgba(239,68,68,0.06)", border: "1px solid rgba(239,68,68,0.2)", borderRadius: "14px", padding: "16px", fontSize: "13px", color: "var(--red)", marginBottom: "24px" }}>
            {error}
            {(error.includes("max usage") || error.includes("429") || error.includes("rate")) && (
              <div style={{ fontSize: "11px", color: "rgba(239,68,68,0.6)", marginTop: "4px" }}>RPC rate limited — wait 30 seconds and try again</div>
            )}
          </div>
        )}

        {/* ═══ RESULTS ═══ */}
        {result && (
          <div ref={resultsRef} style={{ display: "flex", flexDirection: "column", gap: "20px", paddingBottom: "40px" }}>

            {/* Token Card */}
            {tokenInfo && <TokenCard info={tokenInfo} labels={t} />}

            {/* Token header (fallback if no tokenInfo) */}
            {!tokenInfo && (
              <div style={{ display: "flex", alignItems: "center", gap: "12px", flexWrap: "wrap" }}>
                <span style={{ fontSize: "24px", fontWeight: 800, color: "var(--text)" }}>${result.tokenSymbol}</span>
                <span style={{ fontSize: "14px", color: "var(--text-muted)" }}>{result.tokenName}</span>
                <CopyButton text={result.mint} />
              </div>
            )}

            {/* Analysis scope bar */}
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 16px", borderRadius: "12px", background: "var(--bg-card-alt)", border: "1px solid var(--border)" }}>
              <span style={{ fontSize: "12px", color: "var(--text-muted)" }}>
                <strong style={{ color: "var(--text-secondary)" }}>{result.analyzedHolders}</strong> wallets analyzed
                {result.totalHolders > result.analyzedHolders && (
                  <> out of <strong style={{ color: "var(--text-secondary)" }}>{result.totalHolders.toLocaleString()}</strong> total holders</>
                )}
              </span>
              <div style={{ display: "flex", gap: "6px" }}>
                {[20, 50, 100].map(n => (
                  <button key={n} onClick={() => { setAnalyzeLimit(n); analyze(n); }}
                    disabled={loading || n === result.analyzedHolders}
                    className="font-mono"
                    style={{
                      padding: "4px 12px", borderRadius: "8px", fontSize: "11px", fontWeight: 700, border: "1px solid var(--border)", cursor: loading ? "default" : "pointer",
                      background: n === result.analyzedHolders ? "var(--accent-dark)" : "var(--bg-card)",
                      color: n === result.analyzedHolders ? "var(--bg)" : "var(--text-muted)",
                      opacity: loading ? 0.5 : 1,
                    }}>
                    Top {n}
                  </button>
                ))}
              </div>
            </div>

            {/* Verdict card */}
            {verdict && (
              <div className="glass" style={{ borderRadius: "20px", overflow: "hidden" }}>
                <div style={{ padding: "16px 28px", background: "linear-gradient(135deg, var(--accent-dark), var(--accent))", display: "flex", alignItems: "center", gap: "10px" }}>
                  <ShieldIcon size={20} color="white" />
                  <span style={{ fontSize: "15px", fontWeight: 700, color: "white" }}>{t.verdictHeader}</span>
                </div>
                <div style={{ padding: "28px", display: "flex", gap: "28px", alignItems: "flex-start" }}>
                  <div style={{ textAlign: "center", flexShrink: 0 }}>
                    <div className={`${scoreColor(verdict.score)}`} style={{ width: 80, height: 80, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", animation: "pulse-glow 3s ease-in-out infinite" }}>
                      <span style={{ fontSize: "32px", fontWeight: 900, color: "white" }}>{verdict.score}</span>
                    </div>
                    <div className={`${gradeColor(verdict.grade)}`} style={{ fontSize: "28px", fontWeight: 900, marginTop: "6px" }}>{verdict.grade}</div>
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ fontSize: "14px", color: "var(--text-secondary)", lineHeight: 1.7, marginBottom: "16px" }}>{verdict.verdict}</p>
                    <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                      {verdict.flags.map((flag, i) => (
                        <div key={i} style={{ fontSize: "12px", color: "var(--text-secondary)", padding: "6px 10px", borderRadius: "8px", background: "var(--bg-card-alt)", border: "1px solid var(--border)" }}>{flag}</div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Key Metrics */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "10px" }}>
              <MetricCard label={t.freshWallets} value={`${result.metrics.freshWalletPct}%`} sub={`${result.metrics.veryFreshWalletPct}% ${t.under24h}`} warn={result.metrics.freshWalletPct > 40} />
              <MetricCard label={t.veteranHolders} value={`${result.metrics.veteranHolderPct}%`} sub={`${result.metrics.ogHolderPct}% ${t.og180}`} />
              <MetricCard label={t.lowActivity} value={`${result.metrics.lowActivityPct}%`} sub={t.likelyBurner} warn={result.metrics.lowActivityPct > 40} />
              <MetricCard label={t.singleToken} value={`${result.metrics.singleTokenPct}%`} sub={t.onlyHoldThis} warn={result.metrics.singleTokenPct > 30} />
              <MetricCard label={t.avgWalletAge} value={`${result.metrics.avgWalletAgeDays}d`} sub={`${t.median}: ${result.metrics.medianWalletAgeDays}d`} />
              <MetricCard label={t.avgTxCount} value={`${result.metrics.avgTxCount}`} sub={t.lifetimeTx} />
              <MetricCard label={t.avgSolBal} value={`${result.metrics.avgSolBalance}`} sub={t.solPerWallet} warn={result.metrics.avgSolBalance < 0.5} />
              <MetricCard label={t.diamondHands} value={`${result.metrics.diamondHandsPct}%`} sub={t.holding2d} />
            </div>

            {/* Distributions + Radar */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "16px" }}>
              <div className="glass-alt" style={{ borderRadius: "14px", padding: "16px" }}>
                <div style={{ fontSize: "13px", fontWeight: 700, color: "var(--text-secondary)", marginBottom: "12px" }}>Wallet Age Distribution</div>
                <BarChart data={result.distribution.walletAge} color="bg-cyan-500" />
              </div>
              <div className="glass-alt" style={{ borderRadius: "14px", padding: "16px" }}>
                <div style={{ fontSize: "13px", fontWeight: 700, color: "var(--text-secondary)", marginBottom: "12px" }}>Hold Duration Distribution</div>
                <BarChart data={result.distribution.holdDuration} color="bg-emerald-500" />
              </div>
              <RadarChart metrics={result.metrics} />
            </div>

            {/* Top Holders Table */}
            <div className="glass" style={{ borderRadius: "20px", overflow: "hidden" }}>
              <div style={{ padding: "14px 24px", borderBottom: "1px solid rgba(153,69,255,0.1)", display: "flex", alignItems: "center", gap: "10px" }}>
                <LayersIcon size={16} color="var(--accent-dark)" />
                <span style={{ fontSize: "14px", fontWeight: 700, color: "var(--text)" }}>Top 20 Holders</span>
              </div>
              <div style={{ overflowX: "auto" }}>
                <table style={{ width: "100%", fontSize: "11px", borderCollapse: "collapse" }}>
                  <thead>
                    <tr style={{ borderBottom: "1px solid var(--border)" }}>
                      {["#", "Wallet", "Balance %", "Wallet Age", "Txs", "Status"].map(h => (
                        <th key={h} className="font-mono" style={{ padding: "10px 12px", textAlign: h === "#" || h === "Wallet" ? "left" : "right", fontSize: "9px", textTransform: "uppercase", letterSpacing: "0.1em", color: "var(--text-muted)", fontWeight: 600 }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {result.topHolders.map((h, i) => (
                      <tr key={h.address} style={{ borderBottom: "1px solid var(--border)" }}
                        onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = "rgba(153,69,255,0.03)"; }}
                        onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = "transparent"; }}>
                        <td style={{ padding: "8px 12px", color: "var(--text-muted)" }}>{i + 1}</td>
                        <td className="font-mono" style={{ padding: "8px 12px" }}>
                          <a href={`https://solscan.io/account/${h.address}`} target="_blank" rel="noopener" style={{ color: "var(--accent-dark)", textDecoration: "none" }}>{shortenAddr(h.address)}</a>
                        </td>
                        <td style={{ padding: "8px 12px", textAlign: "right", color: "var(--text-secondary)" }}>{h.balancePct}%</td>
                        <td style={{ padding: "8px 12px", textAlign: "right", color: h.walletAgeDays < 7 ? "var(--red)" : h.walletAgeDays > 90 ? "var(--green)" : "var(--text-secondary)" }}>
                          {h.walletAgeDays < 1 ? "<1d" : `${Math.round(h.walletAgeDays)}d`}
                        </td>
                        <td style={{ padding: "8px 12px", textAlign: "right", color: h.totalTxCount < 10 ? "var(--red)" : "var(--text-secondary)" }}>{h.totalTxCount.toLocaleString()}</td>
                        <td style={{ padding: "8px 12px", textAlign: "right" }}>
                          {(h as Record<string, unknown>).isPool ? (
                            <span style={{ color: "#a78bfa", background: "rgba(167,139,250,0.1)", padding: "2px 6px", borderRadius: "4px", fontSize: "9px", fontWeight: 700 }}>POOL</span>
                          ) : h.isFresh ? (
                            <span style={{ color: "var(--red)", background: "rgba(239,68,68,0.1)", padding: "2px 6px", borderRadius: "4px", fontSize: "9px", fontWeight: 700 }}>FRESH</span>
                          ) : h.walletAgeDays > 180 ? (
                            <span style={{ color: "var(--green)", background: "rgba(16,185,129,0.1)", padding: "2px 6px", borderRadius: "4px", fontSize: "9px", fontWeight: 700 }}>OG</span>
                          ) : h.walletAgeDays > 90 ? (
                            <span style={{ color: "var(--accent)", background: "rgba(153,69,255,0.1)", padding: "2px 6px", borderRadius: "4px", fontSize: "9px", fontWeight: 700 }}>VET</span>
                          ) : <span style={{ color: "var(--text-muted)" }}>—</span>}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* All Wallets (collapsible) */}
            <div className="glass-alt" style={{ borderRadius: "14px", padding: "16px" }}>
              <button onClick={() => setShowWallets(!showWallets)} style={{ fontSize: "13px", fontWeight: 700, color: "var(--text-secondary)", background: "none", border: "none", cursor: "pointer", display: "flex", alignItems: "center", gap: "8px" }}>
                <span>{showWallets ? "▼" : "▶"}</span> All Analyzed Wallets ({result.wallets.length})
              </button>
              {showWallets && (
                <div style={{ marginTop: "12px", overflowX: "auto", maxHeight: 400, overflowY: "auto" }}>
                  <table style={{ width: "100%", fontSize: "11px", borderCollapse: "collapse" }}>
                    <thead style={{ position: "sticky", top: 0, background: "var(--bg-card-alt)" }}>
                      <tr style={{ borderBottom: "1px solid var(--border)" }}>
                        {["Wallet", "Age (d)", "Txs", "SOL", "Tokens", "Fresh"].map(h => (
                          <th key={h} className="font-mono" style={{ padding: "8px", textAlign: h === "Wallet" ? "left" : "right", fontSize: "9px", color: "var(--text-muted)", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.1em" }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {result.wallets.map(w => (
                        <tr key={w.address} style={{ borderBottom: "1px solid var(--border)" }}>
                          <td className="font-mono" style={{ padding: "6px 8px" }}>
                            <a href={`https://solscan.io/account/${w.address}`} target="_blank" rel="noopener" style={{ color: "var(--accent-dark)", textDecoration: "none", opacity: 0.7 }}>{shortenAddr(w.address)}</a>
                          </td>
                          <td style={{ padding: "6px 8px", textAlign: "right", color: w.walletAgeDays < 7 ? "var(--red)" : "var(--text-muted)" }}>{w.walletAgeDays.toFixed(1)}</td>
                          <td style={{ padding: "6px 8px", textAlign: "right", color: "var(--text-muted)" }}>{w.totalTxCount}</td>
                          <td style={{ padding: "6px 8px", textAlign: "right", color: "var(--text-muted)" }}>{w.solBalance}</td>
                          <td style={{ padding: "6px 8px", textAlign: "right", color: "var(--text-muted)" }}>{w.otherTokenCount}</td>
                          <td style={{ padding: "6px 8px", textAlign: "right" }}>{w.isFresh ? "🔴" : "🟢"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* Deep scan loading */}
            {deepScanLoading && (
              <div style={{ background: "var(--bg-card)", border: "1px solid var(--border-accent)", borderRadius: "14px", padding: "24px", textAlign: "center" }}>
                <div style={{ display: "inline-block", width: 24, height: 24, border: "2px solid rgba(153,69,255,0.2)", borderTopColor: "var(--accent)", borderRadius: "50%", animation: "spin 1s linear infinite", marginBottom: "12px" }} />
                <div style={{ fontSize: "13px", color: "var(--accent-dark)" }}>Running deep scan...</div>
                <div style={{ fontSize: "11px", color: "var(--text-muted)", marginTop: "4px" }}>Analyzing bundles, funding sources, and buy patterns</div>
              </div>
            )}

            {deepScanError && <div style={{ fontSize: "11px", color: "var(--text-muted)", textAlign: "center", padding: "8px" }}>{deepScanError}</div>}

            {/* Deep scan results */}
            {deepScan && (
              <>
                <div className="font-mono" style={{ fontSize: "10px", fontWeight: 600, color: "var(--accent-dark)", letterSpacing: "0.12em", textTransform: "uppercase", marginTop: "8px" }}>DEEP SCAN RESULTS</div>
                <ConcentrationBar concentration={deepScan.concentration} />
                <BundleDetection bundles={deepScan.bundles} bundleCount={deepScan.bundleCount} bundledWalletCount={deepScan.bundledWalletCount} />
                <FundingClusters clusters={deepScan.fundingClusters} clusterCount={deepScan.clusterCount} clusteredWalletCount={deepScan.clusteredWalletCount} />
                <BuyTimeline timeline={deepScan.buyTimeline} />
                <SolDistChart dist={deepScan.solDistribution} />
                <BubbleScatter wallets={result.wallets} totalSupply={totalSupply} />
              </>
            )}

            {/* Footer note */}
            <div style={{ fontSize: "11px", color: "var(--text-muted)", textAlign: "center", padding: "8px 0", lineHeight: 1.6 }}>
              {t.footerData}
            </div>
          </div>
        )}

        {/* ═══ FOOTER ═══ */}
        <div style={{ padding: "16px 0", display: "flex", alignItems: "center", justifyContent: "space-between", borderTop: "2px solid var(--border)", marginTop: "8px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "12px", fontSize: "12px", color: "var(--text-muted)" }}>
            <span style={{ display: "flex", alignItems: "center", gap: "6px", fontWeight: 700, color: "var(--accent-dark)" }}>
              <img src="/logo.png" alt="" width={16} height={16} style={{ objectFit: "contain" }} /> HOLDERSCOPE
            </span>
            <a href="https://github.com/co-numina" target="_blank" rel="noopener" style={{ display: "flex", alignItems: "center", gap: "4px", color: "inherit", textDecoration: "none" }}>
              <GitHubIcon size={14} /> github
            </a>
            <a href="https://x.com/latebuild" target="_blank" rel="noopener" style={{ display: "flex", alignItems: "center", gap: "4px", color: "inherit", textDecoration: "none" }}>
              <XIcon size={14} /> twitter
            </a>
          </div>
          <div className="font-mono" style={{ fontSize: "10px", color: "var(--text-muted)" }}>{t.footer}</div>
        </div>
      </div>
    </div>
  );
}
