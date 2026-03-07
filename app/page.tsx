"use client";
import { useState, useCallback } from "react";

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

interface DistBucket {
  label: string;
  count: number;
  pct: number;
}

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
  distribution: {
    walletAge: DistBucket[];
    holdDuration: DistBucket[];
  };
  topHolders: {
    address: string;
    balancePct: number;
    walletAgeDays: number;
    holdDurationDays: number;
    totalTxCount: number;
    isFresh: boolean;
  }[];
  wallets: WalletAnalysis[];
}

interface Verdict {
  score: number;
  grade: string;
  verdict: string;
  flags: string[];
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

function shortenAddr(addr: string) {
  return addr.slice(0, 4) + "..." + addr.slice(-4);
}

function gradeColor(grade: string) {
  switch (grade) {
    case "A": return "text-emerald-400";
    case "B": return "text-cyan-400";
    case "C": return "text-yellow-400";
    case "D": return "text-orange-400";
    case "F": return "text-red-400";
    default: return "text-white";
  }
}

function scoreColor(score: number) {
  if (score >= 80) return "bg-emerald-500";
  if (score >= 65) return "bg-cyan-500";
  if (score >= 50) return "bg-yellow-500";
  if (score >= 35) return "bg-orange-500";
  return "bg-red-500";
}

function BarChart({ data, color = "bg-cyan-500" }: { data: DistBucket[]; color?: string }) {
  const max = Math.max(...data.map((d) => d.pct), 1);
  return (
    <div className="space-y-1.5">
      {data.map((d) => (
        <div key={d.label} className="flex items-center gap-2 text-xs">
          <span className="w-24 text-right text-white/50 shrink-0">{d.label}</span>
          <div className="flex-1 h-5 bg-white/5 rounded overflow-hidden">
            <div
              className={`h-full ${color} rounded transition-all duration-500`}
              style={{ width: `${(d.pct / max) * 100}%` }}
            />
          </div>
          <span className="w-16 text-white/70 shrink-0">{d.pct}% ({d.count})</span>
        </div>
      ))}
    </div>
  );
}

function MetricCard({ label, value, sub, warn }: { label: string; value: string; sub?: string; warn?: boolean }) {
  return (
    <div className={`bg-white/5 border ${warn ? "border-red-500/30" : "border-white/10"} rounded-lg p-3`}>
      <div className="text-xs text-white/40 mb-1">{label}</div>
      <div className={`text-xl font-bold ${warn ? "text-red-400" : "text-white"}`}>{value}</div>
      {sub && <div className="text-xs text-white/30 mt-0.5">{sub}</div>}
    </div>
  );
}

/* ─── Deep Scan Visualization Components ─── */

function ConcentrationBar({ concentration }: { concentration: DeepScanResult["concentration"] }) {
  const rest = Math.max(0, 100 - concentration.top20Pct);
  const top5 = concentration.top5Pct;
  const top10Only = concentration.top10Pct - concentration.top5Pct;
  const top20Only = concentration.top20Pct - concentration.top10Pct;

  return (
    <div className="bg-white/5 border border-white/10 rounded-xl p-4">
      <div className="text-sm font-bold text-white/70 mb-3">Token Concentration</div>
      <div className="h-8 rounded-lg overflow-hidden flex">
        {top5 > 0 && (
          <div className="bg-red-500 h-full relative group" style={{ width: `${top5}%` }}>
            <span className="absolute inset-0 flex items-center justify-center text-[10px] font-bold text-black opacity-0 group-hover:opacity-100">
              Top 5: {top5.toFixed(1)}%
            </span>
          </div>
        )}
        {top10Only > 0 && (
          <div className="bg-yellow-500 h-full relative group" style={{ width: `${top10Only}%` }}>
            <span className="absolute inset-0 flex items-center justify-center text-[10px] font-bold text-black opacity-0 group-hover:opacity-100">
              6-10: {top10Only.toFixed(1)}%
            </span>
          </div>
        )}
        {top20Only > 0 && (
          <div className="bg-cyan-500 h-full relative group" style={{ width: `${top20Only}%` }}>
            <span className="absolute inset-0 flex items-center justify-center text-[10px] font-bold text-black opacity-0 group-hover:opacity-100">
              11-20: {top20Only.toFixed(1)}%
            </span>
          </div>
        )}
        {rest > 0 && (
          <div className="bg-white/20 h-full" style={{ width: `${rest}%` }} />
        )}
      </div>
      <div className="flex gap-4 mt-2 text-[10px] text-white/40">
        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded bg-red-500 inline-block" /> Top 5 ({top5.toFixed(1)}%)</span>
        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded bg-yellow-500 inline-block" /> Top 10 ({concentration.top10Pct.toFixed(1)}%)</span>
        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded bg-cyan-500 inline-block" /> Top 20 ({concentration.top20Pct.toFixed(1)}%)</span>
        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded bg-white/20 inline-block" /> Rest ({rest.toFixed(1)}%)</span>
      </div>
      <div className="flex gap-6 mt-2 text-xs text-white/50">
        <span>Gini: <span className={`font-mono ${concentration.giniCoefficient > 0.8 ? "text-red-400" : concentration.giniCoefficient > 0.6 ? "text-yellow-400" : "text-emerald-400"}`}>{concentration.giniCoefficient.toFixed(3)}</span></span>
        <span>HHI: <span className="font-mono text-white/70">{concentration.herfindahlIndex.toFixed(4)}</span></span>
      </div>
    </div>
  );
}

function BundleDetection({ bundles, bundleCount, bundledWalletCount }: { bundles: DeepScanResult["bundles"]; bundleCount: number; bundledWalletCount: number }) {
  const [expanded, setExpanded] = useState<Record<number, boolean>>({});
  if (bundleCount === 0) return null;

  return (
    <div className="bg-red-500/5 border border-red-500/20 rounded-xl p-4">
      <div className="flex items-center gap-2 mb-3">
        <span className="text-red-400 text-lg">⚠️</span>
        <div className="text-sm font-bold text-red-400">Bundle Detection: {bundleCount} bundles found ({bundledWalletCount} wallets)</div>
      </div>
      <div className="space-y-2">
        {bundles.map((b, i) => (
          <div key={i} className="bg-white/5 rounded-lg p-3">
            <button
              onClick={() => setExpanded((p) => ({ ...p, [i]: !p[i] }))}
              className="w-full flex items-center gap-3 text-xs text-left"
            >
              <span className="text-white/30">{expanded[i] ? "▼" : "▶"}</span>
              <span className="text-white/60">Slot {b.slot.toLocaleString()}</span>
              <span className="text-white/40">·</span>
              <span className="text-white/40">{new Date(b.timestamp * 1000).toLocaleString()}</span>
              <span className="text-white/40">·</span>
              <span className="text-red-400 font-bold">{b.wallets.length} wallets</span>
              <span className="text-white/40">·</span>
              <span className="text-white/40">{b.txCount} txs</span>
            </button>
            {expanded[i] && (
              <div className="mt-2 pl-5 space-y-1">
                {b.wallets.map((w) => (
                  <a key={w} href={`https://solscan.io/account/${w}`} target="_blank" rel="noopener" className="block text-xs font-mono text-cyan-400/70 hover:text-cyan-300">
                    {shortenAddr(w)}
                  </a>
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
    <div className="bg-red-500/5 border border-red-500/20 rounded-xl p-4">
      <div className="flex items-center gap-2 mb-3">
        <span className="text-red-400 text-lg">🕸️</span>
        <div className="text-sm font-bold text-red-400">{clusteredWalletCount} wallets funded by same source ({clusterCount} clusters)</div>
      </div>
      <div className="space-y-3">
        {clusters.map((c, i) => (
          <div key={i} className={`bg-white/5 rounded-lg p-3 ${c.count >= 3 ? "border border-red-500/30" : ""}`}>
            <div className="flex items-center gap-2 text-xs mb-2">
              {c.count >= 3 && <span className="text-red-400 text-[10px] font-bold bg-red-400/10 px-1.5 py-0.5 rounded">RED FLAG</span>}
              <a href={`https://solscan.io/account/${c.funder}`} target="_blank" rel="noopener" className="font-mono text-yellow-400/80 hover:text-yellow-300">
                {shortenAddr(c.funder)}
              </a>
              <span className="text-white/30">→ {c.count} wallets</span>
            </div>
            <div className="pl-4 space-y-0.5">
              {c.wallets.map((w) => (
                <a key={w} href={`https://solscan.io/account/${w}`} target="_blank" rel="noopener" className="block text-xs font-mono text-cyan-400/60 hover:text-cyan-300">
                  └ {shortenAddr(w)}
                </a>
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
  const maxMin = Math.max(...timeline.map((t) => t.minutesAfterFirst), 1);

  return (
    <div className="bg-white/5 border border-white/10 rounded-xl p-4">
      <div className="text-sm font-bold text-white/70 mb-3">Buy Timeline</div>
      <div className="relative h-16 bg-white/5 rounded-lg overflow-hidden">
        {timeline.map((t, i) => {
          const left = (t.minutesAfterFirst / maxMin) * 100;
          const color = t.minutesAfterFirst < 5 ? "bg-red-500" : t.minutesAfterFirst < 60 ? "bg-yellow-500" : "bg-emerald-500";
          return (
            <div
              key={i}
              className={`absolute top-1/2 -translate-y-1/2 w-2.5 h-2.5 rounded-full ${color} opacity-80 hover:opacity-100 hover:scale-150 transition-all cursor-pointer group`}
              style={{ left: `${Math.min(left, 99)}%` }}
              title={`${shortenAddr(t.wallet)} — ${t.minutesAfterFirst.toFixed(1)}m after first buy`}
            />
          );
        })}
      </div>
      <div className="flex justify-between text-[10px] text-white/30 mt-1">
        <span>0 min</span>
        <span>{maxMin.toFixed(0)} min</span>
      </div>
      <div className="flex gap-4 mt-2 text-[10px] text-white/40">
        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-red-500 inline-block" /> &lt;5 min (insider risk)</span>
        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-yellow-500 inline-block" /> &lt;60 min</span>
        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-emerald-500 inline-block" /> 60+ min</span>
      </div>
    </div>
  );
}

function SolDistribution({ dist }: { dist: DeepScanResult["solDistribution"] }) {
  const buckets: DistBucket[] = [
    { label: "Dust (<0.1)", count: dist.dust, pct: 0 },
    { label: "Low (0.1-1)", count: dist.low, pct: 0 },
    { label: "Medium (1-10)", count: dist.medium, pct: 0 },
    { label: "High (10-100)", count: dist.high, pct: 0 },
    { label: "Whale (100+)", count: dist.whale, pct: 0 },
  ];
  const total = buckets.reduce((s, b) => s + b.count, 0) || 1;
  buckets.forEach((b) => (b.pct = Math.round((b.count / total) * 1000) / 10));
  const colors = ["bg-red-500", "bg-orange-500", "bg-yellow-500", "bg-cyan-500", "bg-emerald-500"];
  const max = Math.max(...buckets.map((b) => b.pct), 1);

  return (
    <div className="bg-white/5 border border-white/10 rounded-xl p-4">
      <div className="text-sm font-bold text-white/70 mb-3">SOL Balance Distribution</div>
      <div className="space-y-1.5">
        {buckets.map((d, i) => (
          <div key={d.label} className="flex items-center gap-2 text-xs">
            <span className="w-24 text-right text-white/50 shrink-0">{d.label}</span>
            <div className="flex-1 h-5 bg-white/5 rounded overflow-hidden">
              <div className={`h-full ${colors[i]} rounded transition-all duration-500`} style={{ width: `${(d.pct / max) * 100}%` }} />
            </div>
            <span className="w-16 text-white/70 shrink-0">{d.pct}% ({d.count})</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function RadarChart({ metrics }: { metrics: AnalysisResult["metrics"] }) {
  const axes = [
    { label: "Wallet Age", value: Math.min(100, (metrics.avgWalletAgeDays / 365) * 100) },
    { label: "Activity", value: Math.min(100, (metrics.avgTxCount / 1000) * 100) },
    { label: "Diversity", value: 100 - metrics.singleTokenPct },
    { label: "Balance", value: Math.min(100, (metrics.avgSolBalance / 10) * 100) },
    { label: "Organic", value: 100 - metrics.freshWalletPct },
    { label: "Conviction", value: metrics.diamondHandsPct },
  ];

  const cx = 150, cy = 150, r = 100;
  const angleStep = (2 * Math.PI) / 6;
  const startAngle = -Math.PI / 2;

  const getPoint = (i: number, pct: number) => {
    const angle = startAngle + i * angleStep;
    return { x: cx + (r * pct / 100) * Math.cos(angle), y: cy + (r * pct / 100) * Math.sin(angle) };
  };

  const hexPoints = Array.from({ length: 6 }, (_, i) => getPoint(i, 100)).map((p) => `${p.x},${p.y}`).join(" ");
  const valuePoints = axes.map((a, i) => getPoint(i, a.value)).map((p) => `${p.x},${p.y}`).join(" ");

  return (
    <div className="bg-white/5 border border-white/10 rounded-xl p-4">
      <div className="text-sm font-bold text-white/70 mb-3">Holderbase Radar</div>
      <div className="flex justify-center">
        <svg viewBox="0 0 300 300" className="w-64 h-64">
          {/* Grid lines */}
          {[25, 50, 75, 100].map((pct) => (
            <polygon key={pct} points={Array.from({ length: 6 }, (_, i) => getPoint(i, pct)).map((p) => `${p.x},${p.y}`).join(" ")} fill="none" stroke="white" strokeOpacity={0.1} />
          ))}
          {/* Axis lines */}
          {Array.from({ length: 6 }, (_, i) => {
            const p = getPoint(i, 100);
            return <line key={i} x1={cx} y1={cy} x2={p.x} y2={p.y} stroke="white" strokeOpacity={0.1} />;
          })}
          {/* Value polygon */}
          <polygon points={valuePoints} fill="rgb(34,211,238)" fillOpacity={0.2} stroke="rgb(34,211,238)" strokeWidth={2} />
          {/* Value dots */}
          {axes.map((a, i) => {
            const p = getPoint(i, a.value);
            return <circle key={i} cx={p.x} cy={p.y} r={3} fill="rgb(34,211,238)" />;
          })}
          {/* Labels */}
          {axes.map((a, i) => {
            const p = getPoint(i, 130);
            return (
              <text key={i} x={p.x} y={p.y} textAnchor="middle" dominantBaseline="middle" fill="white" fillOpacity={0.5} fontSize={10}>
                {a.label}
              </text>
            );
          })}
        </svg>
      </div>
    </div>
  );
}

function BubbleScatter({ wallets, totalSupply }: { wallets: WalletAnalysis[]; totalSupply: number }) {
  const W = 600, H = 400;
  const maxAge = Math.max(...wallets.map((w) => w.walletAgeDays), 1);
  const logMax = Math.log10(maxAge + 1);

  return (
    <div className="bg-white/5 border border-white/10 rounded-xl p-4">
      <div className="text-sm font-bold text-white/70 mb-3">Wallet Scatter (Age vs Holdings)</div>
      <div className="overflow-x-auto">
        <div className="relative mx-auto" style={{ width: W, height: H }}>
          {/* Axes */}
          <div className="absolute bottom-0 left-0 right-0 h-px bg-white/10" />
          <div className="absolute top-0 bottom-0 left-0 w-px bg-white/10" />
          {/* Bubbles */}
          {wallets.map((w) => {
            const xPct = totalSupply > 0 ? (Math.log10(w.walletAgeDays + 1) / logMax) * 100 : 0;
            const yPct = totalSupply > 0 ? Math.min(((w.balance / totalSupply) * 100), 100) : 0;
            const size = Math.min(Math.sqrt(w.totalTxCount) * 2, 40);
            const color = w.walletAgeDays < 7 ? "bg-red-500" : w.walletAgeDays >= 180 ? "bg-emerald-500" : "bg-cyan-500";
            return (
              <div
                key={w.address}
                className={`absolute rounded-full ${color} opacity-60 hover:opacity-100 transition-opacity cursor-pointer`}
                style={{
                  left: `${Math.max(1, Math.min(xPct, 98))}%`,
                  bottom: `${Math.max(1, Math.min(yPct * 5, 95))}%`,
                  width: Math.max(6, size),
                  height: Math.max(6, size),
                  transform: "translate(-50%, 50%)",
                }}
                title={`${shortenAddr(w.address)}\nAge: ${w.walletAgeDays.toFixed(0)}d | Balance: ${(w.balance / (totalSupply || 1) * 100).toFixed(2)}% | Txs: ${w.totalTxCount}`}
              />
            );
          })}
          {/* Axis labels */}
          <div className="absolute -bottom-5 left-0 text-[10px] text-white/30">0d</div>
          <div className="absolute -bottom-5 right-0 text-[10px] text-white/30">{maxAge.toFixed(0)}d</div>
          <div className="absolute -left-1 top-0 text-[10px] text-white/30 -translate-x-full">high</div>
          <div className="absolute -left-1 bottom-0 text-[10px] text-white/30 -translate-x-full">low</div>
        </div>
      </div>
      <div className="flex gap-4 mt-4 text-[10px] text-white/40 justify-center">
        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-red-500 inline-block" /> Fresh (&lt;7d)</span>
        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-cyan-500 inline-block" /> Veteran</span>
        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-emerald-500 inline-block" /> OG (180d+)</span>
      </div>
    </div>
  );
}

/* ─── Main Page ─── */

export default function Home() {
  const [mint, setMint] = useState("");
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState("");
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [verdict, setVerdict] = useState<Verdict | null>(null);
  const [deepScan, setDeepScan] = useState<DeepScanResult | null>(null);
  const [deepScanLoading, setDeepScanLoading] = useState(false);
  const [deepScanError, setDeepScanError] = useState("");
  const [error, setError] = useState("");
  const [showWallets, setShowWallets] = useState(false);

  const analyze = useCallback(async () => {
    const addr = mint.trim();
    if (!addr) return;
    
    setLoading(true);
    setError("");
    setResult(null);
    setVerdict(null);
    setDeepScan(null);
    setDeepScanError("");
    setProgress("Fetching holders and analyzing wallets...");

    try {
      const res = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mint: addr }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Analysis failed");
      }

      const data: AnalysisResult = await res.json();
      setResult(data);
      setProgress("Generating AI verdict...");

      // Get verdict
      const vRes = await fetch("/api/ai-verdict", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          metrics: data.metrics,
          totalHolders: data.totalHolders,
          tokenSymbol: data.tokenSymbol,
        }),
      });

      if (vRes.ok) {
        const vData = await vRes.json();
        setVerdict(vData);
      }

      // Deep scan (runs after analysis completes)
      setLoading(false);
      setProgress("");
      setDeepScanLoading(true);

      try {
        const totalSupply = data.wallets.reduce((s, w) => s + w.balance, 0);
        const dsRes = await fetch("/api/deep-scan", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            mint: data.mint,
            wallets: data.wallets,
            totalSupply,
          }),
        });

        if (dsRes.ok) {
          const dsData = await dsRes.json();
          setDeepScan(dsData);
        } else {
          setDeepScanError("Deep scan failed — results may be incomplete");
        }
      } catch {
        setDeepScanError("Deep scan failed — results may be incomplete");
      } finally {
        setDeepScanLoading(false);
      }

      return; // skip the finally block's setLoading
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
      setLoading(false);
      setProgress("");
    }
  }, [mint]);

  const totalSupply = result ? result.wallets.reduce((s, w) => s + w.balance, 0) : 0;

  return (
    <div className="min-h-screen bg-[#0a0a0f] text-white">
      {/* Header */}
      <div className="border-b border-white/10 bg-black/40">
        <div className="max-w-5xl mx-auto px-4 py-4 flex items-center gap-3">
          <div className="text-xl font-bold tracking-tight">
            <span className="text-cyan-400">HOLDER</span>
            <span className="text-white/60">SCOPE</span>
          </div>
          <span className="text-xs text-white/30 border border-white/10 rounded px-1.5 py-0.5">BETA</span>
          <div className="flex-1" />
          <span className="text-xs text-white/20">holderbase quality analysis</span>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 py-8">
        {/* Search */}
        <div className="flex gap-2 mb-8">
          <input
            type="text"
            value={mint}
            onChange={(e) => setMint(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && !loading && analyze()}
            placeholder="Paste token mint address..."
            className="flex-1 bg-white/5 border border-white/10 rounded-lg px-4 py-3 text-sm font-mono placeholder:text-white/20 focus:outline-none focus:border-cyan-500/50"
          />
          <button
            onClick={analyze}
            disabled={loading || !mint.trim()}
            className="bg-cyan-500 hover:bg-cyan-400 disabled:bg-white/10 disabled:text-white/30 text-black font-bold px-6 py-3 rounded-lg text-sm transition-colors"
          >
            {loading ? "Analyzing..." : "Analyze"}
          </button>
        </div>

        {/* Loading */}
        {loading && (
          <div className="text-center py-12">
            <div className="inline-block w-8 h-8 border-2 border-cyan-500/30 border-t-cyan-500 rounded-full animate-spin mb-4" />
            <div className="text-sm text-white/50">{progress}</div>
            <div className="text-xs text-white/20 mt-1">Analyzing top 20 holders — takes ~15-20 seconds</div>
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-4 text-sm text-red-400">
            {error}
            {error.includes("max usage") || error.includes("429") || error.includes("rate") ? (
              <div className="text-xs text-red-400/60 mt-1">RPC rate limited — wait 30 seconds and try again</div>
            ) : null}
          </div>
        )}

        {/* Results */}
        {result && (
          <div className="space-y-6">
            {/* Token header */}
            <div className="flex items-center gap-3">
              <div className="text-2xl font-bold">${result.tokenSymbol}</div>
              <div className="text-sm text-white/30">{result.tokenName}</div>
              <div className="text-xs text-white/20 font-mono">{shortenAddr(result.mint)}</div>
              <div className="flex-1" />
              <div className="text-xs text-white/30">
                {result.totalHolders} total holders · {result.analyzedHolders} analyzed
              </div>
            </div>

            {/* Verdict */}
            {verdict && (
              <div className="bg-white/5 border border-white/10 rounded-xl p-6">
                <div className="flex items-start gap-6">
                  {/* Score circle */}
                  <div className="shrink-0 text-center">
                    <div className={`w-20 h-20 rounded-full ${scoreColor(verdict.score)} flex items-center justify-center`}>
                      <span className="text-3xl font-black text-black">{verdict.score}</span>
                    </div>
                    <div className={`text-2xl font-black mt-1 ${gradeColor(verdict.grade)}`}>
                      {verdict.grade}
                    </div>
                  </div>
                  
                  <div className="flex-1 min-w-0">
                    <div className="text-sm text-white/80 leading-relaxed mb-4">{verdict.verdict}</div>
                    <div className="space-y-1.5">
                      {verdict.flags.map((flag, i) => (
                        <div key={i} className="text-xs text-white/60">{flag}</div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Key Metrics Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <MetricCard
                label="Fresh Wallets (<7d)"
                value={`${result.metrics.freshWalletPct}%`}
                sub={`${result.metrics.veryFreshWalletPct}% under 24hrs`}
                warn={result.metrics.freshWalletPct > 40}
              />
              <MetricCard
                label="Veteran Holders (90d+)"
                value={`${result.metrics.veteranHolderPct}%`}
                sub={`${result.metrics.ogHolderPct}% OG (180d+)`}
              />
              <MetricCard
                label="Low Activity (<10 txs)"
                value={`${result.metrics.lowActivityPct}%`}
                sub="likely burner wallets"
                warn={result.metrics.lowActivityPct > 40}
              />
              <MetricCard
                label="Single-Token Holders"
                value={`${result.metrics.singleTokenPct}%`}
                sub="only hold this token"
                warn={result.metrics.singleTokenPct > 30}
              />
              <MetricCard
                label="Avg Wallet Age"
                value={`${result.metrics.avgWalletAgeDays}d`}
                sub={`median: ${result.metrics.medianWalletAgeDays}d`}
              />
              <MetricCard
                label="Avg Tx Count"
                value={`${result.metrics.avgTxCount}`}
                sub="lifetime transactions"
              />
              <MetricCard
                label="Avg SOL Balance"
                value={`${result.metrics.avgSolBalance}`}
                sub="SOL per wallet"
                warn={result.metrics.avgSolBalance < 0.5}
              />
              <MetricCard
                label="Diamond Hands (>2d)"
                value={`${result.metrics.diamondHandsPct}%`}
                sub="holding for 2+ days"
              />
            </div>

            {/* Distributions */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="bg-white/5 border border-white/10 rounded-xl p-4">
                <div className="text-sm font-bold text-white/70 mb-3">Wallet Age Distribution</div>
                <BarChart data={result.distribution.walletAge} color="bg-cyan-500" />
              </div>
              <div className="bg-white/5 border border-white/10 rounded-xl p-4">
                <div className="text-sm font-bold text-white/70 mb-3">Hold Duration Distribution</div>
                <BarChart data={result.distribution.holdDuration} color="bg-emerald-500" />
              </div>
            </div>

            {/* Radar Chart */}
            <RadarChart metrics={result.metrics} />

            {/* Top Holders Table */}
            <div className="bg-white/5 border border-white/10 rounded-xl p-4">
              <div className="text-sm font-bold text-white/70 mb-3">Top 20 Holders</div>
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="text-white/30 border-b border-white/5">
                      <th className="text-left py-2 pr-3">#</th>
                      <th className="text-left py-2 pr-3">Wallet</th>
                      <th className="text-right py-2 pr-3">Balance %</th>
                      <th className="text-right py-2 pr-3">Wallet Age</th>
                      <th className="text-right py-2 pr-3">Txs</th>
                      <th className="text-right py-2">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {result.topHolders.map((h, i) => (
                      <tr key={h.address} className="border-b border-white/5 hover:bg-white/5">
                        <td className="py-2 pr-3 text-white/30">{i + 1}</td>
                        <td className="py-2 pr-3 font-mono">
                          <a
                            href={`https://solscan.io/account/${h.address}`}
                            target="_blank"
                            rel="noopener"
                            className="text-cyan-400/80 hover:text-cyan-300"
                          >
                            {shortenAddr(h.address)}
                          </a>
                        </td>
                        <td className="py-2 pr-3 text-right text-white/70">{h.balancePct}%</td>
                        <td className={`py-2 pr-3 text-right ${h.walletAgeDays < 7 ? "text-red-400" : h.walletAgeDays > 90 ? "text-emerald-400" : "text-white/70"}`}>
                          {h.walletAgeDays < 1 ? "<1d" : `${Math.round(h.walletAgeDays)}d`}
                        </td>
                        <td className={`py-2 pr-3 text-right ${h.totalTxCount < 10 ? "text-red-400" : "text-white/70"}`}>
                          {h.totalTxCount.toLocaleString()}
                        </td>
                        <td className="py-2 text-right">
                          {(h as Record<string, unknown>).isPool ? (
                            <span className="text-purple-400 bg-purple-400/10 px-1.5 py-0.5 rounded">POOL</span>
                          ) : h.isFresh ? (
                            <span className="text-red-400 bg-red-400/10 px-1.5 py-0.5 rounded">FRESH</span>
                          ) : h.walletAgeDays > 180 ? (
                            <span className="text-emerald-400 bg-emerald-400/10 px-1.5 py-0.5 rounded">OG</span>
                          ) : h.walletAgeDays > 90 ? (
                            <span className="text-cyan-400 bg-cyan-400/10 px-1.5 py-0.5 rounded">VET</span>
                          ) : (
                            <span className="text-white/30">—</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* All Wallets (collapsible) */}
            <div className="bg-white/5 border border-white/10 rounded-xl p-4">
              <button
                onClick={() => setShowWallets(!showWallets)}
                className="text-sm font-bold text-white/70 hover:text-white flex items-center gap-2"
              >
                <span>{showWallets ? "▼" : "▶"}</span>
                All Analyzed Wallets ({result.wallets.length})
              </button>
              {showWallets && (
                <div className="mt-3 overflow-x-auto max-h-96 overflow-y-auto">
                  <table className="w-full text-xs">
                    <thead className="sticky top-0 bg-[#0a0a0f]">
                      <tr className="text-white/30 border-b border-white/5">
                        <th className="text-left py-2 pr-2">Wallet</th>
                        <th className="text-right py-2 pr-2">Age (d)</th>
                        <th className="text-right py-2 pr-2">Txs</th>
                        <th className="text-right py-2 pr-2">SOL</th>
                        <th className="text-right py-2 pr-2">Tokens</th>
                        <th className="text-right py-2">Fresh</th>
                      </tr>
                    </thead>
                    <tbody>
                      {result.wallets.map((w) => (
                        <tr key={w.address} className="border-b border-white/5">
                          <td className="py-1.5 pr-2 font-mono">
                            <a href={`https://solscan.io/account/${w.address}`} target="_blank" rel="noopener" className="text-cyan-400/60 hover:text-cyan-300">
                              {shortenAddr(w.address)}
                            </a>
                          </td>
                          <td className={`py-1.5 pr-2 text-right ${w.walletAgeDays < 7 ? "text-red-400" : "text-white/50"}`}>
                            {w.walletAgeDays.toFixed(1)}
                          </td>
                          <td className="py-1.5 pr-2 text-right text-white/50">{w.totalTxCount}</td>
                          <td className="py-1.5 pr-2 text-right text-white/50">{w.solBalance}</td>
                          <td className="py-1.5 pr-2 text-right text-white/50">{w.otherTokenCount}</td>
                          <td className="py-1.5 text-right">
                            {w.isFresh ? "🔴" : "🟢"}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* Deep Scan Loading */}
            {deepScanLoading && (
              <div className="bg-white/5 border border-cyan-500/20 rounded-xl p-6 text-center">
                <div className="inline-block w-6 h-6 border-2 border-cyan-500/30 border-t-cyan-500 rounded-full animate-spin mb-3" />
                <div className="text-sm text-cyan-400/70">Running deep scan...</div>
                <div className="text-xs text-white/20 mt-1">Analyzing bundles, funding sources, and buy patterns</div>
              </div>
            )}

            {/* Deep Scan Error */}
            {deepScanError && (
              <div className="text-xs text-white/30 text-center py-2">{deepScanError}</div>
            )}

            {/* Deep Scan Results */}
            {deepScan && (
              <div className="space-y-6">
                <div className="text-sm font-bold text-white/40 uppercase tracking-wider">Deep Scan Results</div>

                {/* Concentration Bar */}
                <ConcentrationBar concentration={deepScan.concentration} />

                {/* Bundle Detection */}
                <BundleDetection bundles={deepScan.bundles} bundleCount={deepScan.bundleCount} bundledWalletCount={deepScan.bundledWalletCount} />

                {/* Funding Clusters */}
                <FundingClusters clusters={deepScan.fundingClusters} clusterCount={deepScan.clusterCount} clusteredWalletCount={deepScan.clusteredWalletCount} />

                {/* Buy Timeline */}
                <BuyTimeline timeline={deepScan.buyTimeline} />

                {/* SOL Distribution */}
                <SolDistribution dist={deepScan.solDistribution} />

                {/* Bubble Scatter */}
                <BubbleScatter wallets={result.wallets} totalSupply={totalSupply} />
              </div>
            )}

            {/* Footer note */}
            <div className="text-xs text-white/20 text-center">
              Data sourced from Helius RPC · Wallet ages derived from first on-chain transaction · 
              Top 100 holders analyzed · Results are indicative, not definitive
            </div>
          </div>
        )}

        {/* Empty state */}
        {!result && !loading && !error && (
          <div className="text-center py-20">
            <div className="text-4xl mb-4">🔍</div>
            <div className="text-lg text-white/40 mb-2">Paste a Solana token address to analyze its holderbase</div>
            <div className="text-sm text-white/20">
              Analyzes wallet age, activity levels, holder quality, and sybil risk
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
