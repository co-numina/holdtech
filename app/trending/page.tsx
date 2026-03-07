"use client";
import { useState, useEffect, useCallback } from "react";
import Link from "next/link";

interface ScanMetrics {
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
}

interface ScoredToken {
  mint: string;
  name: string;
  symbol: string;
  image: string | null;
  marketCap: number;
  source: string;
  boostAmount?: number;
  holderCount: number;
  freshPct: number;
  avgWalletAgeDays: number;
  grade: string;
  score: number;
  verdict?: string;
  flags?: string[];
  metrics?: ScanMetrics;
  topHolders?: any[];
  distribution?: any;
}

const gradeColors: Record<string, string> = {
  A: "#14F195", B: "#14F195", C: "#eab308", D: "#f97316", F: "#ef4444", "?": "#666688",
};

const sourceLabels: Record<string, { label: string; color: string }> = {
  pump_hot: { label: "TOP MCAP", color: "#9945FF" },
  pump_live: { label: "LIVE NOW", color: "#14F195" },
  pump_graduated: { label: "GRADUATED", color: "#00d4ff" },
  pump_active: { label: "MOST ACTIVE", color: "#ff6b9d" },
  dex_boosted: { label: "BOOSTED", color: "#ffa500" },
};

const fmtMcap = (n: number) => {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000) return `$${(n / 1_000).toFixed(1)}K`;
  return `$${n}`;
};

// Color a percentage — green when low/good, red when high/bad
const pctColor = (v: number, invertGood = false) => {
  if (invertGood) { // higher = better (veterans, diamond hands, OG)
    if (v > 40) return "#14F195";
    if (v > 20) return "#eab308";
    return "#ef4444";
  }
  // higher = worse (fresh, low activity, single token)
  if (v > 60) return "#ef4444";
  if (v > 30) return "#eab308";
  return "#14F195";
};

export default function TrendingPage() {
  const [tokens, setTokens] = useState<ScoredToken[]>([]);
  const [loading, setLoading] = useState(true);
  const [lastUpdate, setLastUpdate] = useState<number | null>(null);
  const [source, setSource] = useState("all");
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [maxMcap, setMaxMcap] = useState<number | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [cacheAge, setCacheAge] = useState<number | null>(null);
  const [expandedMint, setExpandedMint] = useState<string | null>(null);

  const fetchTrending = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/trending-scan?source=${source}`);
      if (res.ok) {
        const data = await res.json();
        setTokens(data.tokens || []);
        setLastUpdate(data.timestamp);
        setCacheAge(data.ageSeconds || null);
        if (data.tokens?.length === 0 && (data.status === "refreshing" || data.status === "refresh_in_progress")) {
          setRefreshing(true);
        } else {
          setRefreshing(false);
        }
      }
    } catch {}
    setLoading(false);
  }, [source]);

  useEffect(() => { fetchTrending(); }, [fetchTrending]);

  useEffect(() => {
    if (!autoRefresh) return;
    const interval = setInterval(fetchTrending, refreshing ? 5000 : 60000);
    return () => clearInterval(interval);
  }, [autoRefresh, fetchTrending, refreshing]);

  const filtered = maxMcap ? tokens.filter(t => t.marketCap > 0 && t.marketCap <= maxMcap) : tokens;

  return (
    <div style={{ minHeight: "100vh", background: "var(--bg)", color: "var(--text)" }}>
      <div style={{ maxWidth: "1200px", margin: "0 auto", padding: "40px 20px" }}>
        {/* Header */}
        <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "8px" }}>
          <Link href="/" style={{ color: "var(--text-muted)", textDecoration: "none", fontSize: "14px" }}>← Back</Link>
        </div>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "24px" }}>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: "14px", marginBottom: "4px" }}>
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/>
              </svg>
              <h1 style={{ fontSize: "28px", fontWeight: 900, margin: 0 }}>Trending Scanner</h1>
              {autoRefresh && (
                <span style={{ display: "inline-flex", alignItems: "center", gap: "6px", padding: "3px 10px", borderRadius: "12px", background: "rgba(20,241,149,0.06)", border: "1px solid rgba(20,241,149,0.12)" }}>
                  <span style={{ width: "6px", height: "6px", borderRadius: "50%", background: "#14F195", animation: "pulse 2s ease-in-out infinite" }} />
                  <span className="font-mono" style={{ fontSize: "9px", color: "#14F195", fontWeight: 700 }}>LIVE</span>
                </span>
              )}
            </div>
            <p style={{ color: "var(--text-muted)", fontSize: "13px", margin: 0 }}>
              Full holder quality scans on trending tokens. Click any row to expand details.
            </p>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <button onClick={() => setAutoRefresh(!autoRefresh)} style={{
              padding: "6px 14px", borderRadius: "8px", fontSize: "10px", fontWeight: 700,
              background: autoRefresh ? "rgba(20,241,149,0.08)" : "var(--bg-card-alt)",
              border: `1px solid ${autoRefresh ? "rgba(20,241,149,0.15)" : "var(--border)"}`,
              color: autoRefresh ? "#14F195" : "var(--text-muted)", cursor: "pointer",
            }}>
              {autoRefresh ? "AUTO ●" : "AUTO ○"}
            </button>
            <button onClick={fetchTrending} disabled={loading} style={{
              padding: "6px 14px", borderRadius: "8px", fontSize: "10px", fontWeight: 700,
              background: "var(--bg-card-alt)", border: "1px solid var(--border)",
              color: "var(--text-muted)", cursor: loading ? "not-allowed" : "pointer",
            }}>
              ↻ REFRESH
            </button>
          </div>
        </div>

        {/* Source filter */}
        <div style={{ display: "flex", gap: "8px", marginBottom: "20px", flexWrap: "wrap" }}>
          {[
            { key: "all", label: "ALL" },
            { key: "pump_graduated", label: "GRADUATED" },
            { key: "pump_hot", label: "TOP MCAP" },
            { key: "pump_live", label: "LIVE NOW" },
            { key: "pump_active", label: "MOST ACTIVE" },
            { key: "dex_boosted", label: "DEX BOOSTED" },
          ].map((s) => (
            <button key={s.key} onClick={() => setSource(s.key)} className="font-mono" style={{
              padding: "6px 14px", borderRadius: "8px", fontSize: "10px", fontWeight: 700,
              background: source === s.key ? "rgba(153,69,255,0.1)" : "var(--bg-card-alt)",
              border: `1px solid ${source === s.key ? "rgba(153,69,255,0.2)" : "var(--border)"}`,
              color: source === s.key ? "var(--accent)" : "var(--text-muted)", cursor: "pointer",
              letterSpacing: "0.5px",
            }}>
              {s.label}
            </button>
          ))}
          <div style={{ marginLeft: "auto", display: "flex", gap: "6px" }}>
            {[
              { value: null, label: "ALL MCAP" },
              { value: 100000, label: "<100K" },
              { value: 500000, label: "<500K" },
              { value: 1000000, label: "<1M" },
            ].map((f) => (
              <button key={f.label} onClick={() => setMaxMcap(f.value)} className="font-mono" style={{
                padding: "6px 10px", borderRadius: "8px", fontSize: "9px", fontWeight: 700,
                background: maxMcap === f.value ? "rgba(20,241,149,0.1)" : "var(--bg-card-alt)",
                border: `1px solid ${maxMcap === f.value ? "rgba(20,241,149,0.2)" : "var(--border)"}`,
                color: maxMcap === f.value ? "#14F195" : "var(--text-muted)", cursor: "pointer",
              }}>
                {f.label}
              </button>
            ))}
          </div>
        </div>

        {/* Loading / Refreshing */}
        {tokens.length === 0 && (loading || refreshing) && (
          <div style={{ textAlign: "center", padding: "80px 0" }}>
            <div style={{ width: "40px", height: "40px", border: "3px solid var(--border)", borderTop: "3px solid var(--accent)", borderRadius: "50%", animation: "spin 0.8s linear infinite", margin: "0 auto 16px" }} />
            <div style={{ color: "var(--text-muted)", fontSize: "13px", marginBottom: "8px" }}>
              {refreshing ? "Running full holder quality scans on trending tokens..." : "Loading..."}
            </div>
            {refreshing && (
              <div style={{ color: "var(--text-muted)", fontSize: "11px", opacity: 0.6 }}>
                Analyzing top 20 holders per token — this takes ~30 seconds on first load
              </div>
            )}
          </div>
        )}

        {/* Table */}
        {filtered.length > 0 && (
          <div className="glass" style={{ borderRadius: "16px", overflow: "hidden" }}>
            {/* Header row */}
            <div style={{
              display: "grid",
              gridTemplateColumns: "36px 1.4fr 80px 60px 65px 55px 60px 60px 55px 55px 65px 50px",
              padding: "10px 16px", background: "var(--bg-card-alt)", borderBottom: "1px solid var(--border)",
              fontSize: "8px", fontWeight: 700, color: "var(--text-muted)", letterSpacing: "0.8px",
            }}>
              <div>#</div>
              <div>TOKEN</div>
              <div>MCAP</div>
              <div>HOLD</div>
              <div style={{ color: "#ef4444" }}>FRESH %</div>
              <div style={{ color: "#14F195" }}>VET %</div>
              <div style={{ color: "#ef4444" }}>BURNER</div>
              <div style={{ color: "#ef4444" }}>1-TKN</div>
              <div>AVG TX</div>
              <div>SOL</div>
              <div>SOURCE</div>
              <div style={{ textAlign: "center" }}>GRADE</div>
            </div>

            {/* Rows */}
            {filtered.map((token, i) => {
              const m = token.metrics;
              const isExpanded = expandedMint === token.mint;
              return (
                <div key={token.mint}>
                  <div
                    onClick={() => setExpandedMint(isExpanded ? null : token.mint)}
                    style={{
                      display: "grid",
                      gridTemplateColumns: "36px 1.4fr 80px 60px 65px 55px 60px 60px 55px 55px 65px 50px",
                      padding: "12px 16px", borderBottom: isExpanded ? "none" : "1px solid var(--border)",
                      color: "var(--text)",
                      background: isExpanded ? "rgba(153,69,255,0.04)" : i % 2 === 0 ? "transparent" : "rgba(255,255,255,0.01)",
                      transition: "background 0.15s",
                      cursor: "pointer",
                      alignItems: "center",
                    }}
                    onMouseEnter={e => { if (!isExpanded) (e.currentTarget as HTMLElement).style.background = "rgba(153,69,255,0.04)"; }}
                    onMouseLeave={e => { if (!isExpanded) (e.currentTarget as HTMLElement).style.background = i % 2 === 0 ? "transparent" : "rgba(255,255,255,0.01)"; }}
                  >
                    <div className="font-mono" style={{ fontSize: "12px", color: "var(--text-muted)", fontWeight: 600 }}>
                      {i + 1}
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: "10px", minWidth: 0 }}>
                      {token.image ? (
                        <img src={token.image} width={28} height={28} style={{ borderRadius: "50%", objectFit: "cover", flexShrink: 0 }} alt="" />
                      ) : (
                        <div style={{ width: 28, height: 28, borderRadius: "50%", background: "var(--bg-card)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "11px", fontWeight: 800, color: "var(--text-muted)", flexShrink: 0 }}>
                          {token.symbol.charAt(0)}
                        </div>
                      )}
                      <div style={{ minWidth: 0 }}>
                        <div className="font-mono" style={{ fontSize: "13px", fontWeight: 800, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>${token.symbol}</div>
                        <div style={{ fontSize: "10px", color: "var(--text-muted)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{token.name}</div>
                      </div>
                    </div>
                    <div className="font-mono" style={{ fontSize: "12px", fontWeight: 700 }}>{fmtMcap(token.marketCap)}</div>
                    <div className="font-mono" style={{ fontSize: "12px", color: "var(--text-muted)" }}>{token.holderCount || "—"}</div>
                    <div className="font-mono" style={{ fontSize: "12px", fontWeight: 700, color: m ? pctColor(m.freshWalletPct) : "var(--text-muted)" }}>
                      {m ? `${m.freshWalletPct}%` : token.freshPct ? `${token.freshPct}%` : "—"}
                    </div>
                    <div className="font-mono" style={{ fontSize: "12px", fontWeight: 700, color: m ? pctColor(m.veteranHolderPct, true) : "var(--text-muted)" }}>
                      {m ? `${m.veteranHolderPct}%` : "—"}
                    </div>
                    <div className="font-mono" style={{ fontSize: "12px", fontWeight: 700, color: m ? pctColor(m.lowActivityPct) : "var(--text-muted)" }}>
                      {m ? `${m.lowActivityPct}%` : "—"}
                    </div>
                    <div className="font-mono" style={{ fontSize: "12px", fontWeight: 700, color: m ? pctColor(m.singleTokenPct) : "var(--text-muted)" }}>
                      {m ? `${m.singleTokenPct}%` : "—"}
                    </div>
                    <div className="font-mono" style={{ fontSize: "12px", color: "var(--text-muted)" }}>
                      {m ? m.avgTxCount : "—"}
                    </div>
                    <div className="font-mono" style={{ fontSize: "12px", color: m ? (m.avgSolBalance < 0.5 ? "#ef4444" : m.avgSolBalance > 5 ? "#14F195" : "var(--text-muted)") : "var(--text-muted)" }}>
                      {m ? m.avgSolBalance.toFixed(1) : "—"}
                    </div>
                    <div>
                      <span className="font-mono" style={{
                        fontSize: "8px", fontWeight: 700, padding: "2px 6px", borderRadius: "4px",
                        background: `${sourceLabels[token.source]?.color || "#666"}11`,
                        color: sourceLabels[token.source]?.color || "#666",
                        border: `1px solid ${sourceLabels[token.source]?.color || "#666"}22`,
                        letterSpacing: "0.5px",
                      }}>
                        {sourceLabels[token.source]?.label || token.source}
                      </span>
                    </div>
                    <div style={{ textAlign: "center" }}>
                      <span className="font-mono" style={{ fontSize: "16px", fontWeight: 900, color: gradeColors[token.grade] || "#666" }}>
                        {token.grade}
                      </span>
                    </div>
                  </div>

                  {/* Expanded detail panel */}
                  {isExpanded && (
                    <div style={{
                      padding: "0 16px 16px", borderBottom: "1px solid var(--border)",
                      background: "rgba(153,69,255,0.02)",
                    }}>
                      {/* Score bar + verdict */}
                      <div style={{ display: "flex", gap: "20px", marginBottom: "16px", alignItems: "flex-start" }}>
                        <div style={{ flex: "0 0 80px", textAlign: "center" }}>
                          <div className="font-mono" style={{ fontSize: "40px", fontWeight: 900, color: gradeColors[token.grade], lineHeight: 1 }}>
                            {token.grade}
                          </div>
                          <div className="font-mono" style={{ fontSize: "14px", color: "var(--text-muted)", marginTop: "4px" }}>{token.score}/100</div>
                        </div>
                        <div style={{ flex: 1 }}>
                          {token.verdict && (
                            <p style={{ fontSize: "13px", color: "var(--text)", lineHeight: 1.5, margin: "0 0 12px" }}>{token.verdict}</p>
                          )}
                          {token.flags && token.flags.length > 0 && (
                            <div style={{ display: "flex", flexWrap: "wrap", gap: "6px" }}>
                              {token.flags.map((flag, fi) => (
                                <span key={fi} style={{
                                  fontSize: "11px", padding: "4px 10px", borderRadius: "6px",
                                  background: flag.startsWith("✅") || flag.startsWith("👍") ? "rgba(20,241,149,0.06)" :
                                    flag.startsWith("🚨") ? "rgba(239,68,68,0.06)" :
                                    flag.startsWith("⚠️") ? "rgba(234,179,8,0.06)" : "rgba(255,255,255,0.03)",
                                  border: `1px solid ${flag.startsWith("✅") || flag.startsWith("👍") ? "rgba(20,241,149,0.12)" :
                                    flag.startsWith("🚨") ? "rgba(239,68,68,0.12)" :
                                    flag.startsWith("⚠️") ? "rgba(234,179,8,0.12)" : "rgba(255,255,255,0.06)"}`,
                                  color: "var(--text)",
                                }}>
                                  {flag}
                                </span>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Full metrics grid */}
                      {m && (
                        <div style={{
                          display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(140px, 1fr))", gap: "8px",
                          marginBottom: "16px",
                        }}>
                          {[
                            { label: "Fresh Wallets (<7d)", value: `${m.freshWalletPct}%`, color: pctColor(m.freshWalletPct) },
                            { label: "Very Fresh (<24h)", value: `${m.veryFreshWalletPct}%`, color: pctColor(m.veryFreshWalletPct) },
                            { label: "Veteran (90d+)", value: `${m.veteranHolderPct}%`, color: pctColor(m.veteranHolderPct, true) },
                            { label: "OG (180d+)", value: `${m.ogHolderPct}%`, color: pctColor(m.ogHolderPct, true) },
                            { label: "Diamond Hands (2d+)", value: `${m.diamondHandsPct}%`, color: pctColor(m.diamondHandsPct, true) },
                            { label: "Low Activity (<10tx)", value: `${m.lowActivityPct}%`, color: pctColor(m.lowActivityPct) },
                            { label: "Single Token", value: `${m.singleTokenPct}%`, color: pctColor(m.singleTokenPct) },
                            { label: "Avg Wallet Age", value: `${m.avgWalletAgeDays}d`, color: m.avgWalletAgeDays > 90 ? "#14F195" : m.avgWalletAgeDays < 7 ? "#ef4444" : "#eab308" },
                            { label: "Median Wallet Age", value: `${m.medianWalletAgeDays}d`, color: "var(--text)" },
                            { label: "Avg Hold Duration", value: `${m.avgHoldDurationDays}d`, color: "var(--text)" },
                            { label: "Avg TX Count", value: `${m.avgTxCount}`, color: m.avgTxCount > 500 ? "#14F195" : m.avgTxCount < 50 ? "#ef4444" : "var(--text)" },
                            { label: "Avg SOL Balance", value: `${m.avgSolBalance} SOL`, color: m.avgSolBalance > 5 ? "#14F195" : m.avgSolBalance < 0.5 ? "#ef4444" : "var(--text)" },
                          ].map((stat, si) => (
                            <div key={si} style={{
                              padding: "10px 12px", borderRadius: "8px",
                              background: "var(--bg-card-alt)", border: "1px solid var(--border)",
                            }}>
                              <div style={{ fontSize: "9px", color: "var(--text-muted)", fontWeight: 700, letterSpacing: "0.5px", marginBottom: "4px", textTransform: "uppercase" }}>
                                {stat.label}
                              </div>
                              <div className="font-mono" style={{ fontSize: "16px", fontWeight: 800, color: stat.color }}>
                                {stat.value}
                              </div>
                            </div>
                          ))}
                        </div>
                      )}

                      {/* Top holders table */}
                      {token.topHolders && token.topHolders.length > 0 && (
                        <div>
                          <div style={{ fontSize: "10px", fontWeight: 700, color: "var(--text-muted)", marginBottom: "8px", letterSpacing: "0.5px" }}>
                            TOP HOLDERS (analyzed {token.topHolders.length})
                          </div>
                          <div style={{ borderRadius: "8px", overflow: "hidden", border: "1px solid var(--border)" }}>
                            <div style={{
                              display: "grid", gridTemplateColumns: "1fr 70px 70px 65px 60px 50px",
                              padding: "6px 12px", background: "var(--bg-card-alt)",
                              fontSize: "8px", fontWeight: 700, color: "var(--text-muted)", letterSpacing: "0.8px",
                            }}>
                              <div>WALLET</div>
                              <div>BALANCE %</div>
                              <div>WALLET AGE</div>
                              <div>TX COUNT</div>
                              <div>SOL BAL</div>
                              <div>STATUS</div>
                            </div>
                            {token.topHolders.slice(0, 10).map((h: any, hi: number) => (
                              <div key={hi} style={{
                                display: "grid", gridTemplateColumns: "1fr 70px 70px 65px 60px 50px",
                                padding: "6px 12px", borderTop: "1px solid var(--border)",
                                fontSize: "11px", background: hi % 2 ? "rgba(255,255,255,0.01)" : "transparent",
                              }}>
                                <div className="font-mono" style={{ color: h.isPool ? "#9945FF" : "var(--text-muted)", overflow: "hidden", textOverflow: "ellipsis" }}>
                                  {h.isPool ? "🏊 POOL" : `${h.address.slice(0, 4)}...${h.address.slice(-4)}`}
                                </div>
                                <div className="font-mono" style={{ fontWeight: 700, color: h.balancePct > 10 ? "#ef4444" : "var(--text)" }}>
                                  {h.balancePct}%
                                </div>
                                <div className="font-mono" style={{ color: h.walletAgeDays < 7 ? "#ef4444" : h.walletAgeDays > 90 ? "#14F195" : "var(--text-muted)" }}>
                                  {h.walletAgeDays < 1 ? `${Math.round(h.walletAgeDays * 24)}h` : `${Math.round(h.walletAgeDays)}d`}
                                </div>
                                <div className="font-mono" style={{ color: "var(--text-muted)" }}>{h.totalTxCount}</div>
                                <div className="font-mono" style={{ color: "var(--text-muted)" }}>—</div>
                                <div>
                                  {h.isFresh && !h.isPool && (
                                    <span style={{ fontSize: "8px", padding: "1px 5px", borderRadius: "3px", background: "rgba(239,68,68,0.1)", color: "#ef4444", fontWeight: 700 }}>FRESH</span>
                                  )}
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Action buttons */}
                      <div style={{ display: "flex", gap: "8px", marginTop: "16px" }}>
                        <a href={`/?mint=${token.mint}`} style={{
                          padding: "8px 20px", borderRadius: "8px", fontSize: "11px", fontWeight: 700,
                          background: "var(--accent)", color: "#fff", textDecoration: "none",
                          display: "inline-flex", alignItems: "center", gap: "6px",
                        }}>
                          🔍 FULL SCAN
                        </a>
                        <a href={`https://pump.fun/coin/${token.mint}`} target="_blank" rel="noopener" style={{
                          padding: "8px 16px", borderRadius: "8px", fontSize: "11px", fontWeight: 700,
                          background: "var(--bg-card-alt)", border: "1px solid var(--border)",
                          color: "var(--text-muted)", textDecoration: "none",
                        }}>
                          pump.fun ↗
                        </a>
                        <a href={`https://dexscreener.com/solana/${token.mint}`} target="_blank" rel="noopener" style={{
                          padding: "8px 16px", borderRadius: "8px", fontSize: "11px", fontWeight: 700,
                          background: "var(--bg-card-alt)", border: "1px solid var(--border)",
                          color: "var(--text-muted)", textDecoration: "none",
                        }}>
                          DexScreener ↗
                        </a>
                        <button
                          onClick={() => { navigator.clipboard.writeText(token.mint); }}
                          style={{
                            padding: "8px 16px", borderRadius: "8px", fontSize: "11px", fontWeight: 700,
                            background: "var(--bg-card-alt)", border: "1px solid var(--border)",
                            color: "var(--text-muted)", cursor: "pointer",
                          }}
                        >
                          📋 Copy CA
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* No results */}
        {!loading && !refreshing && filtered.length === 0 && tokens.length > 0 && (
          <div style={{ textAlign: "center", padding: "60px 0", color: "var(--text-muted)", fontSize: "13px" }}>
            No tokens match the selected filters
          </div>
        )}

        {/* Last update */}
        {lastUpdate && (
          <div className="font-mono" style={{ fontSize: "10px", color: "var(--text-muted)", textAlign: "center", padding: "16px 0" }}>
            Last scan: {new Date(lastUpdate).toLocaleTimeString()}{cacheAge !== null ? ` (${cacheAge}s ago)` : ""} · {loading ? "Refreshing..." : autoRefresh ? "Auto-refresh on" : "Auto-refresh paused"}
          </div>
        )}
      </div>

      <style jsx>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.4; }
        }
      `}</style>
    </div>
  );
}
