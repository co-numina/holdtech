"use client";
import { useState, useEffect, useCallback } from "react";
import Link from "next/link";

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
  sniperCount?: number;
  volume?: number;
  topHoldersPct?: number;
  devHoldingsPct?: number;
  sniperOwnedPct?: number;
}

const gradeColors: Record<string, string> = {
  "A": "#14F195",
  "B": "#14F195",
  "C": "#eab308",
  "D": "#f97316",
  "F": "#ef4444",
  "?": "#666688",
};

const sourceLabels: Record<string, { label: string; color: string }> = {
  pump_hot: { label: "TOP MCAP", color: "#9945FF" },
  pump_live: { label: "LIVE NOW", color: "#14F195" },
  pump_graduated: { label: "GRADUATED", color: "#00d4ff" },
  dex_boosted: { label: "BOOSTED", color: "#ffa500" },
};

const fmtMcap = (n: number) => {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000) return `$${(n / 1_000).toFixed(1)}K`;
  return `$${n}`;
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

  const fetchTrending = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/trending-scan?source=${source}`);
      if (res.ok) {
        const data = await res.json();
        setTokens(data.tokens || []);
        setLastUpdate(data.timestamp);
        setCacheAge(data.ageSeconds || null);
        // If no tokens and status is refreshing, poll faster until results arrive
        if (data.tokens?.length === 0 && (data.status === "refreshing" || data.status === "refresh_in_progress")) {
          setRefreshing(true);
        } else {
          setRefreshing(false);
        }
      }
    } catch {}
    setLoading(false);
  }, [source]);

  useEffect(() => {
    fetchTrending();
  }, [fetchTrending]);

  // When refreshing (no cache yet), poll every 5s. Otherwise every 60s.
  useEffect(() => {
    if (!autoRefresh) return;
    const interval = setInterval(fetchTrending, refreshing ? 5000 : 60000);
    return () => clearInterval(interval);
  }, [autoRefresh, fetchTrending, refreshing]);

  return (
    <div style={{ minHeight: "100vh", background: "var(--bg)", color: "var(--text)" }}>
      <div style={{ maxWidth: "1000px", margin: "0 auto", padding: "40px 20px" }}>
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
              Full holder quality scans on trending tokens. Cached & refreshed every 5 min.
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
        <div style={{ display: "flex", gap: "8px", marginBottom: "20px" }}>
          {[
            { key: "all", label: "ALL" },
            { key: "pump_graduated", label: "GRADUATED" },
            { key: "pump_hot", label: "TOP MCAP" },
            { key: "pump_live", label: "LIVE NOW" },
            { key: "dex_boosted", label: "DEX BOOSTED" },
          ].map((s: { key: string; label: string }) => (
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
            ].map((f: { value: number | null; label: string }) => (
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
        {tokens.length > 0 && (() => {
          const filtered = maxMcap ? tokens.filter(t => t.marketCap > 0 && t.marketCap <= maxMcap) : tokens;
          return filtered.length > 0 && (
          <div className="glass" style={{ borderRadius: "16px", overflow: "hidden" }}>
            {/* Header row */}
            <div style={{
              display: "grid", gridTemplateColumns: "36px 1fr 85px 65px 65px 60px 75px 50px",
              padding: "10px 16px", background: "var(--bg-card-alt)", borderBottom: "1px solid var(--border)",
              fontSize: "9px", fontWeight: 700, color: "var(--text-muted)", letterSpacing: "1px",
            }}>
              <div>#</div>
              <div>TOKEN</div>
              <div>MCAP</div>
              <div>HOLDERS</div>
              <div>SNIPERS</div>
              <div>TOP %</div>
              <div>SOURCE</div>
              <div style={{ textAlign: "center" }}>GRADE</div>
            </div>

            {/* Rows */}
            {filtered.map((token, i) => (
              <a
                key={token.mint}
                href={`/?mint=${token.mint}`}
                style={{
                  display: "grid", gridTemplateColumns: "36px 1fr 85px 65px 65px 60px 75px 50px",
                  padding: "12px 16px", borderBottom: "1px solid var(--border)",
                  textDecoration: "none", color: "var(--text)",
                  background: i % 2 === 0 ? "transparent" : "rgba(255,255,255,0.01)",
                  transition: "background 0.15s",
                  cursor: "pointer",
                }}
                onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = "rgba(153,69,255,0.04)"; }}
                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = i % 2 === 0 ? "transparent" : "rgba(255,255,255,0.01)"; }}
              >
                <div className="font-mono" style={{ fontSize: "12px", color: "var(--text-muted)", fontWeight: 600, alignSelf: "center" }}>
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
                <div className="font-mono" style={{ fontSize: "12px", fontWeight: 700, alignSelf: "center" }}>
                  {fmtMcap(token.marketCap)}
                </div>
                <div className="font-mono" style={{ fontSize: "12px", alignSelf: "center", color: "var(--text-muted)" }}>
                  {token.holderCount || "—"}
                </div>
                <div className="font-mono" style={{ fontSize: "12px", alignSelf: "center", color: (token.sniperCount || 0) > 50 ? "var(--red)" : (token.sniperCount || 0) > 20 ? "#eab308" : "var(--text-muted)" }}>
                  {token.sniperCount || "—"}
                </div>
                <div className="font-mono" style={{ fontSize: "12px", alignSelf: "center", color: (token.topHoldersPct || 0) > 60 ? "var(--red)" : (token.topHoldersPct || 0) > 40 ? "#eab308" : "var(--text-muted)" }}>
                  {token.topHoldersPct ? `${token.topHoldersPct}%` : "—"}
                </div>
                <div style={{ alignSelf: "center" }}>
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
                <div style={{ textAlign: "center", alignSelf: "center" }}>
                  <span className="font-mono" style={{
                    fontSize: "16px", fontWeight: 900,
                    color: gradeColors[token.grade] || "#666",
                  }}>
                    {token.grade}
                  </span>
                </div>
              </a>
            ))}
          </div>
        );
        })()}

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
