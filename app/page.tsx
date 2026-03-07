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

export default function Home() {
  const [mint, setMint] = useState("");
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState("");
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [verdict, setVerdict] = useState<Verdict | null>(null);
  const [error, setError] = useState("");
  const [showWallets, setShowWallets] = useState(false);

  const analyze = useCallback(async () => {
    const addr = mint.trim();
    if (!addr) return;
    
    setLoading(true);
    setError("");
    setResult(null);
    setVerdict(null);
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

      const data = await res.json();
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
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setLoading(false);
      setProgress("");
    }
  }, [mint]);

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
