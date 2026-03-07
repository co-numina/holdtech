"use client";
import { useWallet } from "@solana/wallet-adapter-react";
import { WalletMultiButton } from "@solana/wallet-adapter-react-ui";
import { useConnection } from "@solana/wallet-adapter-react";
import { PublicKey } from "@solana/web3.js";
import { useState, useEffect, useCallback, useRef } from "react";

const HOLDTECH_MINT = "";
const TIERS = [
  { name: "FREE", min: 0, color: "#888", icon: "○" },
  { name: "SCOUT", min: 5_000_000, color: "#9945FF", icon: "◐" },
  { name: "OPERATOR", min: 10_000_000, color: "#9945FF", icon: "●" },
  { name: "WHALE", min: 20_000_000, color: "#14F195", icon: "◆" },
];

interface ScanResult {
  mint: string; symbol: string; score: number; grade: string;
  holders: number; top5Pct: number; freshPct: number; avgAge: number; timestamp: number;
}
interface WatchlistItem {
  mint: string; symbol: string; lastScore: number; lastGrade: string;
  lastHolders: number; addedAt: number; history: { score: number; timestamp: number }[];
}
interface FeedEvent {
  wallet: string; walletName: string; walletEmoji: string; walletGroup: string;
  type: "buy" | "sell" | "transfer"; tokenMint: string; tokenSymbol: string;
  tokenImage: string; amount: number; solAmount: number; signature: string; timestamp: number;
}

function getTier(b: number) { let t = TIERS[0]; for (const x of TIERS) { if (b >= x.min) t = x; } return t; }
function timeAgo(ts: number) { const d = Date.now() - ts; if (d < 60000) return "now"; if (d < 3600000) return `${Math.floor(d / 60000)}m`; if (d < 86400000) return `${Math.floor(d / 3600000)}h`; return `${Math.floor(d / 86400000)}d`; }
function gc(g: string) { if (g?.startsWith("A")) return "#14F195"; if (g?.startsWith("B")) return "#4ade80"; if (g?.startsWith("C")) return "#eab308"; if (g?.startsWith("D")) return "#f97316"; return "#ef4444"; }

export default function Dashboard() {
  const { publicKey, connected } = useWallet();
  const { connection } = useConnection();
  const [tokenBalance, setTokenBalance] = useState(0);
  const [tab, setTab] = useState<"overview" | "scan" | "watchlist" | "history" | "batch" | "bundlers">("overview");
  const [scanInput, setScanInput] = useState("");
  const [batchInput, setBatchInput] = useState("");
  const [scanning, setScanning] = useState(false);
  const [scanResult, setScanResult] = useState<ScanResult | null>(null);
  const [batchResults, setBatchResults] = useState<ScanResult[]>([]);
  const [batchScanning, setBatchScanning] = useState(false);
  const [history, setHistory] = useState<ScanResult[]>([]);
  const [watchlist, setWatchlist] = useState<WatchlistItem[]>([]);
  const [bundlers, setBundlers] = useState<{ address: string; label: string; emoji?: string; group?: string; addedAt: number; seenIn: string[] }[]>([]);
  const [bundlerInput, setBundlerInput] = useState("");
  const [bundlerLabel, setBundlerLabel] = useState("");
  const [progress, setProgress] = useState("");
  const [feedEvents, setFeedEvents] = useState<FeedEvent[]>([]);
  const [feedLoading, setFeedLoading] = useState(false);
  const [autoRefresh, setAutoRefresh] = useState(false);
  const [showManage, setShowManage] = useState(false);
  const [darkMode, setDarkMode] = useState(false);
  const [feedLimit, setFeedLimit] = useState(50);
  const historyRef = useRef(history); historyRef.current = history;
  const intervalRef = useRef<any>(null);

  useEffect(() => {
    try {
      setHistory(JSON.parse(localStorage.getItem("holdtech-history") || "[]"));
      setWatchlist(JSON.parse(localStorage.getItem("holdtech-watchlist") || "[]"));
      setBundlers(JSON.parse(localStorage.getItem("holdtech-bundlers") || "[]"));
      const theme = localStorage.getItem("holdtech-theme");
      if (theme === "dark") { setDarkMode(true); document.documentElement.setAttribute("data-theme", "dark"); }
    } catch {}
  }, []);

  useEffect(() => {
    if (!connected || !publicKey || !HOLDTECH_MINT) { setTokenBalance(HOLDTECH_MINT ? 0 : 999_999_999); return; }
    (async () => {
      try {
        const mint = new PublicKey(HOLDTECH_MINT);
        const accs = await connection.getParsedTokenAccountsByOwner(publicKey, { mint });
        setTokenBalance(accs.value.reduce((s, a) => s + (a.account.data.parsed?.info?.tokenAmount?.uiAmount || 0), 0));
      } catch { setTokenBalance(0); }
    })();
  }, [connected, publicKey, connection]);

  const tier = getTier(tokenBalance);
  const isDemo = !HOLDTECH_MINT;
  const toggleTheme = () => { const n = !darkMode; setDarkMode(n); document.documentElement.setAttribute("data-theme", n ? "dark" : ""); localStorage.setItem("holdtech-theme", n ? "dark" : "light"); };

  const runScan = useCallback(async (mint: string): Promise<ScanResult | null> => {
    try {
      const [aR, cR] = await Promise.all([
        fetch("/api/analyze", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ mint }) }),
        fetch("/api/holder-count", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ mint }) }),
      ]);
      if (!aR.ok) return null;
      const a = await aR.json(); const c = cR.ok ? await cR.json() : { count: null };
      const w = a.wallets || []; const supply = a.totalSupply || 1;
      const top5 = w.slice(0, 5).reduce((s: number, x: any) => s + (x.balance || 0), 0);
      const vR = await fetch("/api/ai-verdict", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ metrics: a.metrics, totalHolders: c.count || a.analyzedHolders, analyzedHolders: a.analyzedHolders, tokenSymbol: a.tokenSymbol }) });
      const v = vR.ok ? await vR.json() : null;
      return { mint, symbol: a.tokenSymbol || mint.slice(0, 6), score: v?.score ?? 0, grade: v?.grade || "?", holders: c.count || a.totalHolders || w.length, top5Pct: parseFloat(((top5 / supply) * 100).toFixed(1)), freshPct: a.metrics?.freshWalletPct ?? 0, avgAge: Math.round(a.metrics?.avgWalletAgeDays ?? 0), timestamp: Date.now() };
    } catch { return null; }
  }, []);

  const handleScan = async () => {
    if (!scanInput.trim() || scanning) return;
    setScanning(true); setProgress("Analyzing..."); setScanResult(null);
    const r = await runScan(scanInput.trim());
    if (r) { setScanResult(r); const nh = [r, ...historyRef.current.filter(h => h.mint !== r.mint)].slice(0, 50); setHistory(nh); localStorage.setItem("holdtech-history", JSON.stringify(nh)); }
    setScanning(false); setProgress("");
  };

  const handleBatch = async () => {
    const mints = batchInput.split(/[\n,]+/).map(s => s.trim()).filter(s => s.length > 30);
    if (!mints.length || batchScanning) return;
    const lim = tier.name === "FREE" ? 2 : tier.name === "SCOUT" ? 5 : tier.name === "OPERATOR" ? 20 : 50;
    setBatchScanning(true); setBatchResults([]);
    const results: ScanResult[] = [];
    for (let i = 0; i < Math.min(mints.length, lim); i++) {
      setProgress(`${i + 1}/${Math.min(mints.length, lim)}`);
      const r = await runScan(mints[i]); if (r) { results.push(r); setBatchResults([...results]); }
    }
    setBatchScanning(false); setProgress("");
  };

  const addWatch = (r: ScanResult) => {
    if (watchlist.find(w => w.mint === r.mint)) return;
    const lim = tier.name === "FREE" ? 3 : tier.name === "SCOUT" ? 10 : tier.name === "OPERATOR" ? 50 : 200;
    if (watchlist.length >= lim) return;
    const nw = [...watchlist, { mint: r.mint, symbol: r.symbol, lastScore: r.score, lastGrade: r.grade, lastHolders: r.holders, addedAt: Date.now(), history: [{ score: r.score, timestamp: Date.now() }] }];
    setWatchlist(nw); localStorage.setItem("holdtech-watchlist", JSON.stringify(nw));
  };
  const rmWatch = (mint: string) => { const nw = watchlist.filter(w => w.mint !== mint); setWatchlist(nw); localStorage.setItem("holdtech-watchlist", JSON.stringify(nw)); };

  const fetchFeed = useCallback(async () => {
    if (bundlers.length === 0) return; setFeedLoading(true);
    try {
      const all: FeedEvent[] = [];
      for (let i = 0; i < bundlers.length; i += 10) {
        const batch = bundlers.slice(i, i + 10).map(b => ({ address: b.address, name: b.label, emoji: b.emoji || "🚩", group: b.group || "tracked" }));
        const r = await fetch("/api/bundler-feed", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ wallets: batch }) });
        if (r.ok) { const d = await r.json(); all.push(...(d.events || [])); }
      }
      all.sort((a, b) => b.timestamp - a.timestamp); setFeedEvents(all);
    } catch {} setFeedLoading(false);
  }, [bundlers]);

  useEffect(() => { if (tab === "bundlers" && bundlers.length > 0 && feedEvents.length === 0) fetchFeed(); }, [tab, bundlers.length]);
  useEffect(() => { if (autoRefresh && tab === "bundlers") { intervalRef.current = setInterval(fetchFeed, 30000); return () => clearInterval(intervalRef.current); } else if (intervalRef.current) clearInterval(intervalRef.current); }, [autoRefresh, tab, fetchFeed]);

  const loadDefaults = async () => {
    try {
      const r = await fetch("/bundlers-default.json"); const d = await r.json();
      const ex = new Set(bundlers.map(b => b.address));
      const nw = [...bundlers, ...d.filter((x: any) => !ex.has(x.address)).map((x: any) => ({ address: x.address, label: x.name, emoji: x.emoji, group: x.group, addedAt: Date.now(), seenIn: [] as string[] }))];
      setBundlers(nw); localStorage.setItem("holdtech-bundlers", JSON.stringify(nw));
    } catch {}
  };

  // ── GATE ──
  if (!isDemo && !connected) {
    return (
      <div style={{ minHeight: "100vh", background: "#f0f0f6", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif" }}>
        <div style={{ textAlign: "center" }}>
          <a href="/" style={{ display: "inline-flex", alignItems: "center", gap: "8px", textDecoration: "none", marginBottom: "24px" }}>
            <img src="/logo.png" alt="" width={40} height={40} /><span style={{ fontSize: "26px", fontWeight: 800 }}><span style={{ color: "#9945FF" }}>HOLD</span><span style={{ color: "#888" }}>TECH</span></span>
          </a>
          <div style={{ fontSize: "14px", color: "#888", marginBottom: "24px" }}>Connect wallet to access dashboard</div>
          <WalletMultiButton />
        </div>
      </div>
    );
  }

  // Stats for overview
  const avgScore = history.length > 0 ? Math.round(history.reduce((s, h) => s + h.score, 0) / history.length) : 0;
  const bestScan = history.length > 0 ? history.reduce((b, h) => h.score > b.score ? h : b, history[0]) : null;
  const worstScan = history.length > 0 ? history.reduce((w, h) => h.score < w.score ? h : w, history[0]) : null;
  const recentScans = history.slice(0, 5);
  const gradeDistribution = { A: 0, B: 0, C: 0, D: 0, F: 0 };
  history.forEach(h => { const k = h.grade?.[0] as keyof typeof gradeDistribution; if (k in gradeDistribution) gradeDistribution[k]++; });

  // Styles
  const M: React.CSSProperties = { fontFamily: "'Courier New', monospace" };

  const tabs = [
    { id: "overview" as const, label: "Overview", icon: "◫" },
    { id: "scan" as const, label: "Scan", icon: "⊕" },
    { id: "watchlist" as const, label: `Watchlist`, icon: "◉", count: watchlist.length },
    { id: "history" as const, label: "History", icon: "◷", count: history.length },
    { id: "batch" as const, label: "Batch", icon: "▤" },
    { id: "bundlers" as const, label: "Bundlers", icon: "⬡", count: bundlers.length },
  ];

  return (
    <div style={{ minHeight: "100vh", background: "var(--bg, #f0f0f6)", fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif", color: "var(--text, #1a1a2e)" }}>
      <div style={{ position: "fixed", inset: 0, zIndex: 0, pointerEvents: "none", backgroundImage: "linear-gradient(rgba(153,69,255,0.04) 1px, transparent 1px), linear-gradient(90deg, rgba(153,69,255,0.04) 1px, transparent 1px)", backgroundSize: "48px 48px", maskImage: "linear-gradient(to bottom, black 50%, transparent 100%)", WebkitMaskImage: "linear-gradient(to bottom, black 50%, transparent 100%)" }} />

      <div style={{ position: "relative", zIndex: 1, display: "flex", minHeight: "100vh" }}>
        {/* ═══ SIDEBAR ═══ */}
        <div style={{ width: "220px", flexShrink: 0, padding: "16px", display: "flex", flexDirection: "column", gap: "4px", borderRight: "1px solid var(--border, rgba(153,69,255,0.08))", background: "var(--card-bg, rgba(255,255,255,0.3))", backdropFilter: "blur(8px)" }}>
          <a href="/" style={{ display: "flex", alignItems: "center", gap: "8px", textDecoration: "none", padding: "8px 12px", marginBottom: "8px" }}>
            <img src="/logo.png" alt="" width={24} height={24} style={{ objectFit: "contain" }} />
            <span style={{ fontSize: "16px", fontWeight: 800 }}><span style={{ color: "var(--accent, #9945FF)" }}>HOLD</span><span style={{ color: "var(--text-muted, #888)" }}>TECH</span></span>
          </a>

          {tabs.map(t => (
            <button key={t.id} onClick={() => setTab(t.id)} style={{ ...M, display: "flex", alignItems: "center", gap: "10px", padding: "9px 12px", borderRadius: "10px", border: "none", cursor: "pointer", fontSize: "12px", fontWeight: 600, textAlign: "left" as const, width: "100%", background: tab === t.id ? "rgba(153,69,255,0.1)" : "transparent", color: tab === t.id ? "var(--accent, #9945FF)" : "var(--text-muted, #888)", transition: "all 0.15s" }}>
              <span style={{ fontSize: "14px", width: "18px", textAlign: "center" }}>{t.icon}</span>
              <span style={{ flex: 1 }}>{t.label}</span>
              {t.count !== undefined && t.count > 0 && <span style={{ fontSize: "9px", fontWeight: 700, background: tab === t.id ? "rgba(153,69,255,0.15)" : "rgba(0,0,0,0.04)", padding: "2px 6px", borderRadius: "4px" }}>{t.count}</span>}
            </button>
          ))}

          <div style={{ flex: 1 }} />

          {/* Tier badge */}
          <div style={{ padding: "12px", borderRadius: "10px", background: `${tier.color}08`, border: `1px solid ${tier.color}20`, marginTop: "8px" }}>
            <div style={{ ...M, fontSize: "9px", fontWeight: 700, color: tier.color, letterSpacing: "0.1em" }}>{tier.icon} {tier.name}{isDemo ? " · DEMO" : ""}</div>
            {!isDemo && <div style={{ fontSize: "10px", color: "var(--text-muted, #888)", marginTop: "4px" }}>{tokenBalance.toLocaleString()} $HOLDTECH</div>}
          </div>

          <div style={{ display: "flex", gap: "4px", marginTop: "4px" }}>
            <button onClick={toggleTheme} style={{ flex: 1, padding: "8px", borderRadius: "8px", border: "none", background: "rgba(0,0,0,0.03)", cursor: "pointer", fontSize: "14px" }}>{darkMode ? "☀️" : "🌙"}</button>
            <a href="/docs" style={{ flex: 1, padding: "8px", borderRadius: "8px", background: "rgba(0,0,0,0.03)", textDecoration: "none", textAlign: "center", fontSize: "10px", fontWeight: 600, color: "var(--text-muted, #888)", display: "flex", alignItems: "center", justifyContent: "center" }}>DOCS</a>
          </div>
        </div>

        {/* ═══ MAIN ═══ */}
        <div style={{ flex: 1, padding: "24px 32px", maxWidth: "800px" }}>

          {/* ═══ OVERVIEW ═══ */}
          {tab === "overview" && (
            <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
              <div style={{ ...M, fontSize: "18px", fontWeight: 800 }}>Dashboard</div>

              {/* Stat cards */}
              <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "12px" }}>
                {[
                  { label: "Total Scans", value: history.length.toString(), sub: "all time" },
                  { label: "Avg Score", value: avgScore ? `${avgScore}/100` : "—", sub: history.length > 0 ? `across ${history.length} scans` : "no data" },
                  { label: "Watching", value: watchlist.length.toString(), sub: `of ${tier.name === "FREE" ? 3 : tier.name === "SCOUT" ? 10 : tier.name === "OPERATOR" ? 50 : 200} slots` },
                  { label: "Bundlers", value: bundlers.length.toString(), sub: "wallets tracked" },
                ].map(s => (
                  <div key={s.label} style={{ background: "var(--card-bg, rgba(255,255,255,0.6))", backdropFilter: "blur(12px)", border: "1px solid var(--border, rgba(153,69,255,0.08))", borderRadius: "12px", padding: "16px" }}>
                    <div style={{ ...M, fontSize: "9px", fontWeight: 700, color: "var(--text-muted, #888)", letterSpacing: "0.08em", textTransform: "uppercase" }}>{s.label}</div>
                    <div style={{ ...M, fontSize: "24px", fontWeight: 800, marginTop: "4px" }}>{s.value}</div>
                    <div style={{ fontSize: "10px", color: "var(--text-muted, #aaa)", marginTop: "2px" }}>{s.sub}</div>
                  </div>
                ))}
              </div>

              {/* Grade distribution */}
              {history.length > 0 && (
                <div style={{ background: "var(--card-bg, rgba(255,255,255,0.6))", backdropFilter: "blur(12px)", border: "1px solid var(--border, rgba(153,69,255,0.08))", borderRadius: "12px", padding: "20px" }}>
                  <div style={{ ...M, fontSize: "11px", fontWeight: 700, marginBottom: "14px" }}>GRADE DISTRIBUTION</div>
                  <div style={{ display: "flex", gap: "8px", alignItems: "flex-end", height: "80px" }}>
                    {(["A", "B", "C", "D", "F"] as const).map(g => {
                      const count = gradeDistribution[g];
                      const pct = history.length > 0 ? (count / history.length) * 100 : 0;
                      return (
                        <div key={g} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: "4px" }}>
                          <div style={{ ...M, fontSize: "10px", fontWeight: 700, color: "var(--text-muted, #888)" }}>{count}</div>
                          <div style={{ width: "100%", borderRadius: "4px 4px 0 0", background: gc(g), height: `${Math.max(pct, 4)}%`, minHeight: "3px", opacity: count > 0 ? 1 : 0.15, transition: "height 0.3s" }} />
                          <div style={{ ...M, fontSize: "11px", fontWeight: 800, color: gc(g) }}>{g}</div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Recent + Best/Worst */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
                {/* Recent scans */}
                <div style={{ background: "var(--card-bg, rgba(255,255,255,0.6))", backdropFilter: "blur(12px)", border: "1px solid var(--border, rgba(153,69,255,0.08))", borderRadius: "12px", padding: "20px" }}>
                  <div style={{ ...M, fontSize: "11px", fontWeight: 700, marginBottom: "12px" }}>RECENT SCANS</div>
                  {recentScans.length === 0 && <div style={{ fontSize: "12px", color: "var(--text-muted, #aaa)", padding: "12px 0" }}>No scans yet. <button onClick={() => setTab("scan")} style={{ background: "none", border: "none", color: "#9945FF", cursor: "pointer", fontWeight: 600, fontSize: "12px" }}>Start scanning →</button></div>}
                  {recentScans.map((h, i) => (
                    <div key={h.mint + i} onClick={() => { setScanInput(h.mint); setTab("scan"); }} style={{ display: "flex", alignItems: "center", gap: "10px", padding: "8px 0", borderTop: i > 0 ? "1px solid var(--border, rgba(0,0,0,0.04))" : "none", cursor: "pointer" }}>
                      <span style={{ ...M, fontSize: "16px", fontWeight: 800, color: gc(h.grade), minWidth: "28px" }}>{h.grade}</span>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: "12px", fontWeight: 600 }}>{h.symbol}</div>
                        <div style={{ ...M, fontSize: "9px", color: "var(--text-muted, #aaa)" }}>{h.score}/100 · {h.holders.toLocaleString()} holders</div>
                      </div>
                      <span style={{ ...M, fontSize: "10px", color: "var(--text-muted, #aaa)" }}>{timeAgo(h.timestamp)}</span>
                    </div>
                  ))}
                </div>

                {/* Highlights */}
                <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                  {bestScan && (
                    <div style={{ background: "var(--card-bg, rgba(255,255,255,0.6))", backdropFilter: "blur(12px)", border: "1px solid rgba(20,241,149,0.15)", borderRadius: "12px", padding: "16px" }}>
                      <div style={{ ...M, fontSize: "9px", fontWeight: 700, color: "#14F195", letterSpacing: "0.08em" }}>CLEANEST TOKEN</div>
                      <div style={{ display: "flex", alignItems: "center", gap: "10px", marginTop: "8px" }}>
                        <span style={{ ...M, fontSize: "24px", fontWeight: 800, color: gc(bestScan.grade) }}>{bestScan.grade}</span>
                        <div>
                          <div style={{ fontSize: "14px", fontWeight: 700 }}>{bestScan.symbol}</div>
                          <div style={{ ...M, fontSize: "10px", color: "var(--text-muted, #888)" }}>{bestScan.score}/100 · {bestScan.freshPct}% fresh</div>
                        </div>
                      </div>
                    </div>
                  )}
                  {worstScan && worstScan.mint !== bestScan?.mint && (
                    <div style={{ background: "var(--card-bg, rgba(255,255,255,0.6))", backdropFilter: "blur(12px)", border: "1px solid rgba(239,68,68,0.12)", borderRadius: "12px", padding: "16px" }}>
                      <div style={{ ...M, fontSize: "9px", fontWeight: 700, color: "#ef4444", letterSpacing: "0.08em" }}>WORST TOKEN</div>
                      <div style={{ display: "flex", alignItems: "center", gap: "10px", marginTop: "8px" }}>
                        <span style={{ ...M, fontSize: "24px", fontWeight: 800, color: gc(worstScan.grade) }}>{worstScan.grade}</span>
                        <div>
                          <div style={{ fontSize: "14px", fontWeight: 700 }}>{worstScan.symbol}</div>
                          <div style={{ ...M, fontSize: "10px", color: "var(--text-muted, #888)" }}>{worstScan.score}/100 · {worstScan.freshPct}% fresh</div>
                        </div>
                      </div>
                    </div>
                  )}
                  {/* Quick actions */}
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px" }}>
                    <button onClick={() => setTab("scan")} style={{ ...M, padding: "14px", borderRadius: "10px", border: "1px solid var(--border, rgba(153,69,255,0.12))", background: "var(--card-bg, rgba(255,255,255,0.6))", cursor: "pointer", fontSize: "11px", fontWeight: 700, color: "var(--accent, #9945FF)", textAlign: "left" }}>⊕ New Scan</button>
                    <button onClick={() => setTab("bundlers")} style={{ ...M, padding: "14px", borderRadius: "10px", border: "1px solid var(--border, rgba(153,69,255,0.12))", background: "var(--card-bg, rgba(255,255,255,0.6))", cursor: "pointer", fontSize: "11px", fontWeight: 700, color: "var(--text-muted, #888)", textAlign: "left" }}>⬡ Bundler Feed</button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ═══ SCAN ═══ */}
          {tab === "scan" && (
            <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
              <div style={{ ...M, fontSize: "18px", fontWeight: 800 }}>Scan Token</div>
              <div style={{ display: "flex", gap: "8px" }}>
                <input value={scanInput} onChange={e => setScanInput(e.target.value)} onKeyDown={e => e.key === "Enter" && handleScan()} placeholder="Paste token address..." style={{ flex: 1, padding: "12px 14px", border: "1px solid var(--border, rgba(153,69,255,0.15))", borderRadius: "12px", fontSize: "13px", background: "var(--card-bg, rgba(255,255,255,0.8))", ...M, outline: "none", color: "var(--text, #1a1a2e)" }} spellCheck={false} />
                <button onClick={handleScan} disabled={scanning} style={{ ...M, padding: "12px 24px", background: "linear-gradient(135deg, #9945FF, #7B3FE4)", color: "white", border: "none", borderRadius: "12px", fontSize: "12px", fontWeight: 700, cursor: "pointer", opacity: scanning ? 0.5 : 1 }}>{scanning ? progress || "..." : "SCAN"}</button>
              </div>
              {scanning && <div style={{ textAlign: "center", padding: "40px", color: "var(--text-muted, #888)" }}><div style={{ display: "inline-block", width: 28, height: 28, border: "2.5px solid rgba(153,69,255,0.12)", borderTopColor: "#9945FF", borderRadius: "50%", animation: "spin 1s linear infinite", marginBottom: "10px" }} /><div style={{ ...M, fontSize: "12px" }}>{progress}</div></div>}
              {scanResult && (
                <div style={{ background: "var(--card-bg, rgba(255,255,255,0.6))", backdropFilter: "blur(12px)", border: "1px solid var(--border, rgba(153,69,255,0.08))", borderRadius: "14px", padding: "24px" }}>
                  <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: "20px" }}>
                    <div>
                      <div style={{ fontSize: "20px", fontWeight: 800 }}>{scanResult.symbol}</div>
                      <div style={{ ...M, fontSize: "11px", color: "var(--text-muted, #888)", marginTop: "2px" }}>{scanResult.mint}</div>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                      <button onClick={() => addWatch(scanResult)} style={{ ...M, padding: "6px 14px", background: "transparent", color: "var(--accent, #9945FF)", border: "1px solid rgba(153,69,255,0.2)", borderRadius: "8px", fontSize: "11px", fontWeight: 600, cursor: "pointer" }}>+ Watch</button>
                      <a href={`/?mint=${scanResult.mint}`} target="_blank" style={{ ...M, padding: "6px 14px", background: "transparent", color: "var(--accent, #9945FF)", border: "1px solid rgba(153,69,255,0.2)", borderRadius: "8px", fontSize: "11px", fontWeight: 600, textDecoration: "none" }}>Full →</a>
                      <div style={{ ...M, fontSize: "32px", fontWeight: 800, color: gc(scanResult.grade), background: `${gc(scanResult.grade)}15`, padding: "4px 18px", borderRadius: "12px" }}>{scanResult.grade}</div>
                    </div>
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: "10px" }}>
                    {[{ l: "Score", v: `${scanResult.score}/100` }, { l: "Holders", v: scanResult.holders.toLocaleString() }, { l: "Top 5", v: `${scanResult.top5Pct}%` }, { l: "Fresh", v: `${scanResult.freshPct}%` }, { l: "Avg Age", v: `${scanResult.avgAge}d` }].map(m => (
                      <div key={m.l} style={{ background: "rgba(153,69,255,0.03)", borderRadius: "10px", padding: "12px" }}>
                        <div style={{ ...M, fontSize: "9px", fontWeight: 700, color: "var(--text-muted, #888)", letterSpacing: "0.08em", textTransform: "uppercase" }}>{m.l}</div>
                        <div style={{ ...M, fontSize: "20px", fontWeight: 800, marginTop: "4px" }}>{m.v}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ═══ WATCHLIST ═══ */}
          {tab === "watchlist" && (
            <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "8px" }}>
                <div style={{ ...M, fontSize: "18px", fontWeight: 800 }}>Watchlist</div>
                <span style={{ ...M, fontSize: "10px", color: "var(--text-muted, #888)" }}>{watchlist.length}/{tier.name === "FREE" ? 3 : tier.name === "SCOUT" ? 10 : tier.name === "OPERATOR" ? 50 : 200} · {tier.name}</span>
              </div>
              {watchlist.length === 0 && <div style={{ background: "var(--card-bg, rgba(255,255,255,0.6))", border: "1px solid var(--border, rgba(153,69,255,0.08))", borderRadius: "14px", padding: "48px", textAlign: "center", color: "var(--text-muted, #aaa)" }}><div style={{ fontSize: "28px", marginBottom: "8px", opacity: 0.4 }}>◉</div><div style={{ fontSize: "13px" }}>Scan a token and click &quot;+ Watch&quot;</div></div>}
              {watchlist.map(w => (
                <div key={w.mint} style={{ background: "var(--card-bg, rgba(255,255,255,0.6))", backdropFilter: "blur(12px)", border: "1px solid var(--border, rgba(153,69,255,0.08))", borderRadius: "12px", padding: "14px 20px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "14px" }}>
                    <span style={{ ...M, fontSize: "24px", fontWeight: 800, color: gc(w.lastGrade), minWidth: "36px" }}>{w.lastGrade}</span>
                    <div>
                      <div style={{ fontSize: "14px", fontWeight: 700 }}>{w.symbol}</div>
                      <div style={{ ...M, fontSize: "10px", color: "var(--text-muted, #888)" }}>{w.lastScore}/100 · {w.lastHolders.toLocaleString()} holders</div>
                    </div>
                  </div>
                  <div style={{ display: "flex", gap: "6px" }}>
                    <button onClick={() => { setScanInput(w.mint); setTab("scan"); }} style={{ ...M, padding: "6px 12px", background: "transparent", color: "var(--accent, #9945FF)", border: "1px solid rgba(153,69,255,0.2)", borderRadius: "8px", fontSize: "10px", fontWeight: 600, cursor: "pointer" }}>Rescan</button>
                    <button onClick={() => rmWatch(w.mint)} style={{ ...M, padding: "6px 12px", background: "transparent", color: "#ef4444", border: "1px solid rgba(239,68,68,0.15)", borderRadius: "8px", fontSize: "10px", fontWeight: 600, cursor: "pointer" }}>×</button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* ═══ HISTORY ═══ */}
          {tab === "history" && (
            <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "8px" }}>
                <div style={{ ...M, fontSize: "18px", fontWeight: 800 }}>Scan History</div>
                {history.length > 0 && <button onClick={() => { setHistory([]); localStorage.removeItem("holdtech-history"); }} style={{ ...M, padding: "4px 10px", background: "transparent", color: "var(--text-muted, #aaa)", border: "1px solid rgba(0,0,0,0.06)", borderRadius: "6px", fontSize: "10px", cursor: "pointer" }}>Clear</button>}
              </div>
              {history.length === 0 && <div style={{ background: "var(--card-bg, rgba(255,255,255,0.6))", border: "1px solid var(--border, rgba(153,69,255,0.08))", borderRadius: "14px", padding: "48px", textAlign: "center", color: "var(--text-muted, #aaa)" }}><div style={{ fontSize: "28px", marginBottom: "8px", opacity: 0.4 }}>◷</div><div style={{ fontSize: "13px" }}>No scans yet</div></div>}
              {history.length > 0 && <div style={{ display: "grid", gridTemplateColumns: "36px 1fr 64px 64px 56px 56px 56px", gap: "6px", padding: "6px 16px", ...M, fontSize: "9px", color: "var(--text-muted, #888)", letterSpacing: "0.06em", textTransform: "uppercase" as const }}><span></span><span>Token</span><span>Score</span><span>Holders</span><span>Top 5</span><span>Fresh</span><span>When</span></div>}
              {history.map((h, i) => (
                <div key={h.mint + i} onClick={() => { setScanInput(h.mint); setTab("scan"); }} style={{ background: "var(--card-bg, rgba(255,255,255,0.6))", border: "1px solid var(--border, rgba(153,69,255,0.06))", borderRadius: "10px", display: "grid", gridTemplateColumns: "36px 1fr 64px 64px 56px 56px 56px", gap: "6px", alignItems: "center", padding: "10px 16px", cursor: "pointer", transition: "border-color 0.15s" }}>
                  <span style={{ ...M, fontSize: "16px", fontWeight: 800, color: gc(h.grade) }}>{h.grade}</span>
                  <div><div style={{ fontSize: "12px", fontWeight: 600 }}>{h.symbol}</div><div style={{ ...M, fontSize: "9px", color: "var(--text-muted, #aaa)" }}>{h.mint.slice(0, 6)}..{h.mint.slice(-4)}</div></div>
                  <span style={{ ...M, fontSize: "12px", fontWeight: 700 }}>{h.score}</span>
                  <span style={{ ...M, fontSize: "11px", color: "var(--text-secondary, #666)" }}>{h.holders.toLocaleString()}</span>
                  <span style={{ ...M, fontSize: "11px", color: "var(--text-secondary, #666)" }}>{h.top5Pct}%</span>
                  <span style={{ ...M, fontSize: "11px", color: h.freshPct > 40 ? "#ef4444" : "var(--text-secondary, #666)" }}>{h.freshPct}%</span>
                  <span style={{ ...M, fontSize: "10px", color: "var(--text-muted, #aaa)" }}>{timeAgo(h.timestamp)}</span>
                </div>
              ))}
            </div>
          )}

          {/* ═══ BATCH ═══ */}
          {tab === "batch" && (
            <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
              <div style={{ ...M, fontSize: "18px", fontWeight: 800 }}>Batch Scan</div>
              <div style={{ background: "var(--card-bg, rgba(255,255,255,0.6))", backdropFilter: "blur(12px)", border: "1px solid var(--border, rgba(153,69,255,0.08))", borderRadius: "14px", padding: "20px" }}>
                <div style={{ fontSize: "12px", color: "var(--text-muted, #888)", marginBottom: "12px" }}>Paste multiple addresses. Max {tier.name === "FREE" ? 2 : tier.name === "SCOUT" ? 5 : tier.name === "OPERATOR" ? 20 : 50} ({tier.name})</div>
                <textarea value={batchInput} onChange={e => setBatchInput(e.target.value)} placeholder="One per line or comma-separated..." style={{ width: "100%", padding: "12px", border: "1px solid var(--border, rgba(153,69,255,0.12))", borderRadius: "10px", fontSize: "12px", background: "var(--card-bg, rgba(255,255,255,0.8))", ...M, outline: "none", minHeight: "100px", resize: "vertical", color: "var(--text, #1a1a2e)" }} spellCheck={false} />
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: "12px" }}>
                  <span style={{ ...M, fontSize: "11px", color: "var(--text-muted, #888)" }}>{batchInput.split(/[\n,]+/).filter(s => s.trim().length > 30).length} tokens</span>
                  <button onClick={handleBatch} disabled={batchScanning} style={{ ...M, padding: "10px 20px", background: "linear-gradient(135deg, #9945FF, #7B3FE4)", color: "white", border: "none", borderRadius: "10px", fontSize: "11px", fontWeight: 700, cursor: "pointer", opacity: batchScanning ? 0.5 : 1 }}>{batchScanning ? `Scanning ${progress}` : "SCAN ALL"}</button>
                </div>
              </div>
              {batchResults.length > 0 && [...batchResults].sort((a, b) => b.score - a.score).map((r, i) => (
                <div key={r.mint} style={{ background: "var(--card-bg, rgba(255,255,255,0.6))", border: "1px solid var(--border, rgba(153,69,255,0.06))", borderRadius: "10px", display: "flex", alignItems: "center", gap: "14px", padding: "12px 16px" }}>
                  <span style={{ ...M, fontSize: "20px", fontWeight: 800, color: gc(r.grade), minWidth: "32px" }}>{r.grade}</span>
                  <div style={{ flex: 1 }}><span style={{ fontSize: "13px", fontWeight: 700 }}>{r.symbol}</span></div>
                  <span style={{ ...M, fontSize: "12px", fontWeight: 700 }}>{r.score}/100</span>
                  <span style={{ ...M, fontSize: "11px", color: "var(--text-secondary, #666)" }}>{r.holders.toLocaleString()}</span>
                  <span style={{ ...M, fontSize: "11px", color: "var(--text-secondary, #666)" }}>{r.top5Pct}%</span>
                  <a href={`/?mint=${r.mint}`} target="_blank" style={{ ...M, fontSize: "10px", color: "#9945FF", textDecoration: "none" }}>→</a>
                </div>
              ))}
            </div>
          )}

          {/* ═══ BUNDLERS ═══ */}
          {tab === "bundlers" && (
            <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <div style={{ ...M, fontSize: "18px", fontWeight: 800 }}>Bundler Feed</div>
                <div style={{ display: "flex", gap: "6px" }}>
                  <button onClick={() => setAutoRefresh(!autoRefresh)} style={{ ...M, padding: "5px 10px", background: autoRefresh ? "rgba(20,241,149,0.08)" : "transparent", color: autoRefresh ? "#14F195" : "var(--text-muted, #888)", border: `1px solid ${autoRefresh ? "rgba(20,241,149,0.2)" : "var(--border, rgba(0,0,0,0.08))"}`, borderRadius: "6px", fontSize: "10px", fontWeight: 700, cursor: "pointer" }}>{autoRefresh ? "● LIVE" : "○ AUTO"}</button>
                  <button onClick={fetchFeed} disabled={feedLoading} style={{ ...M, padding: "5px 10px", background: "transparent", color: "var(--accent, #9945FF)", border: "1px solid rgba(153,69,255,0.15)", borderRadius: "6px", fontSize: "10px", fontWeight: 600, cursor: "pointer", opacity: feedLoading ? 0.5 : 1 }}>{feedLoading ? "..." : "Refresh"}</button>
                  <button onClick={() => setShowManage(!showManage)} style={{ ...M, padding: "5px 10px", background: "transparent", color: "var(--text-muted, #888)", border: "1px solid var(--border, rgba(0,0,0,0.08))", borderRadius: "6px", fontSize: "10px", fontWeight: 600, cursor: "pointer" }}>{showManage ? "Close" : "Manage"}</button>
                </div>
              </div>

              {showManage && (
                <div style={{ background: "var(--card-bg, rgba(255,255,255,0.6))", backdropFilter: "blur(12px)", border: "1px solid var(--border, rgba(153,69,255,0.08))", borderRadius: "14px", padding: "16px" }}>
                  <div style={{ display: "flex", gap: "6px", marginBottom: "10px" }}>
                    <input value={bundlerInput} onChange={e => setBundlerInput(e.target.value)} placeholder="Wallet address..." style={{ flex: 2, padding: "8px 10px", border: "1px solid var(--border, rgba(153,69,255,0.12))", borderRadius: "8px", fontSize: "11px", ...M, outline: "none", background: "var(--card-bg, rgba(255,255,255,0.8))", color: "var(--text, #1a1a2e)" }} spellCheck={false} />
                    <input value={bundlerLabel} onChange={e => setBundlerLabel(e.target.value)} placeholder="Label" style={{ flex: 1, padding: "8px 10px", border: "1px solid var(--border, rgba(153,69,255,0.12))", borderRadius: "8px", fontSize: "11px", ...M, outline: "none", background: "var(--card-bg, rgba(255,255,255,0.8))", color: "var(--text, #1a1a2e)" }} />
                    <button onClick={() => { const a = bundlerInput.trim(); if (!a || a.length < 32 || bundlers.find(b => b.address === a)) return; const n = [...bundlers, { address: a, label: bundlerLabel.trim() || a.slice(0, 8), emoji: "🚩", group: "custom", addedAt: Date.now(), seenIn: [] as string[] }]; setBundlers(n); localStorage.setItem("holdtech-bundlers", JSON.stringify(n)); setBundlerInput(""); setBundlerLabel(""); }} style={{ ...M, padding: "8px 14px", background: "linear-gradient(135deg, #9945FF, #7B3FE4)", color: "white", border: "none", borderRadius: "8px", fontSize: "10px", fontWeight: 700, cursor: "pointer" }}>ADD</button>
                  </div>
                  <div style={{ display: "flex", gap: "6px", marginBottom: "10px" }}>
                    <button onClick={loadDefaults} style={{ ...M, padding: "5px 10px", background: "transparent", color: "var(--accent, #9945FF)", border: "1px solid rgba(153,69,255,0.15)", borderRadius: "6px", fontSize: "10px", fontWeight: 600, cursor: "pointer" }}>Load Defaults ({bundlers.length > 0 ? "merge" : "42"})</button>
                    <button onClick={() => navigator.clipboard.writeText(JSON.stringify(bundlers.map(b => ({ address: b.address, label: b.label, emoji: b.emoji, group: b.group })), null, 2))} style={{ ...M, padding: "5px 10px", background: "transparent", color: "var(--text-muted, #888)", border: "1px solid var(--border, rgba(0,0,0,0.06))", borderRadius: "6px", fontSize: "10px", fontWeight: 600, cursor: "pointer" }}>Export</button>
                  </div>
                  <textarea id="imp-json" placeholder="Paste JSON or addresses..." style={{ width: "100%", padding: "8px", border: "1px solid var(--border, rgba(153,69,255,0.1))", borderRadius: "8px", fontSize: "10px", ...M, outline: "none", minHeight: "40px", resize: "vertical", background: "var(--card-bg, rgba(255,255,255,0.8))", color: "var(--text, #1a1a2e)" }} spellCheck={false} />
                  <button onClick={() => { const el = document.getElementById("imp-json") as HTMLTextAreaElement; if (!el?.value.trim()) return; const ex = new Set(bundlers.map(b => b.address)); let nw: any[] = []; try { const p = JSON.parse(el.value); if (Array.isArray(p)) nw = p.filter((d: any) => !ex.has(d.trackedWalletAddress || d.address)).map((d: any) => ({ address: d.trackedWalletAddress || d.address, label: d.name || d.label || "—", emoji: d.emoji || "🚩", group: d.groups?.[0] || d.group || "imported", addedAt: Date.now(), seenIn: [] as string[] })); } catch { nw = el.value.split(/[\n,]+/).map(s => s.trim()).filter(s => s.length >= 32 && !ex.has(s)).map(a => ({ address: a, label: a.slice(0, 8), emoji: "🚩", group: "imported", addedAt: Date.now(), seenIn: [] as string[] })); } if (nw.length) { const nb = [...bundlers, ...nw]; setBundlers(nb); localStorage.setItem("holdtech-bundlers", JSON.stringify(nb)); el.value = ""; } }} style={{ ...M, padding: "6px 12px", background: "linear-gradient(135deg, #9945FF, #7B3FE4)", color: "white", border: "none", borderRadius: "6px", fontSize: "10px", fontWeight: 700, cursor: "pointer", marginTop: "6px" }}>IMPORT</button>
                  <div style={{ maxHeight: "160px", overflow: "auto", marginTop: "10px", borderTop: "1px solid var(--border, rgba(0,0,0,0.04))", paddingTop: "6px" }}>
                    {bundlers.map(b => (
                      <div key={b.address} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "3px 0", fontSize: "10px" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: "5px" }}>
                          <span>{b.emoji}</span><span style={{ fontWeight: 600 }}>{b.label}</span>
                          <span style={{ ...M, fontSize: "8px", color: "var(--text-muted, #aaa)" }}>{b.address.slice(0, 6)}..{b.address.slice(-4)}</span>
                          {b.group && <span style={{ fontSize: "7px", color: "#9945FF", background: "rgba(153,69,255,0.06)", padding: "1px 3px", borderRadius: "2px" }}>{b.group}</span>}
                        </div>
                        <button onClick={() => { const n = bundlers.filter(x => x.address !== b.address); setBundlers(n); localStorage.setItem("holdtech-bundlers", JSON.stringify(n)); }} style={{ background: "none", border: "none", cursor: "pointer", color: "#ccc", fontSize: "12px" }}>×</button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {bundlers.length === 0 && (
                <div style={{ background: "var(--card-bg, rgba(255,255,255,0.6))", border: "1px solid var(--border, rgba(153,69,255,0.08))", borderRadius: "14px", padding: "48px", textAlign: "center" }}>
                  <div style={{ fontSize: "28px", marginBottom: "12px", opacity: 0.4 }}>⬡</div>
                  <div style={{ fontSize: "13px", fontWeight: 600, marginBottom: "4px" }}>No bundler wallets tracked</div>
                  <div style={{ fontSize: "11px", color: "var(--text-muted, #888)", marginBottom: "16px" }}>Load defaults or add your own</div>
                  <button onClick={loadDefaults} style={{ ...M, padding: "10px 20px", background: "linear-gradient(135deg, #9945FF, #7B3FE4)", color: "white", border: "none", borderRadius: "10px", fontSize: "11px", fontWeight: 700, cursor: "pointer" }}>Load Default Ruggers</button>
                </div>
              )}

              {feedLoading && feedEvents.length === 0 && <div style={{ textAlign: "center", padding: "40px", color: "var(--text-muted, #888)" }}><div style={{ display: "inline-block", width: 24, height: 24, border: "2px solid rgba(153,69,255,0.12)", borderTopColor: "#9945FF", borderRadius: "50%", animation: "spin 1s linear infinite" }} /></div>}

              {feedEvents.length > 0 && <div style={{ ...M, fontSize: "10px", color: "var(--text-muted, #888)" }}>{Math.min(feedLimit, feedEvents.length)} of {feedEvents.length} transactions</div>}

              {feedEvents.slice(0, feedLimit).map((ev, i) => (
                <div key={`${ev.signature}-${i}`} style={{ background: "var(--card-bg, rgba(255,255,255,0.6))", border: "1px solid var(--border, rgba(153,69,255,0.06))", borderRadius: "10px", display: "flex", alignItems: "center", gap: "12px", padding: "10px 14px" }}>
                  <div style={{ width: 38, height: 38, borderRadius: "8px", overflow: "hidden", flexShrink: 0, background: "rgba(153,69,255,0.03)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                    {ev.tokenImage ? <img src={ev.tokenImage} alt="" width={38} height={38} style={{ objectFit: "cover" }} onError={e => { (e.target as HTMLImageElement).style.display = "none"; }} /> : <span style={{ fontSize: "16px", opacity: 0.25 }}>🪙</span>}
                  </div>
                  <div style={{ ...M, fontSize: "9px", fontWeight: 800, color: ev.type === "buy" ? "#14F195" : "#ef4444", background: ev.type === "buy" ? "rgba(20,241,149,0.08)" : "rgba(239,68,68,0.06)", padding: "3px 7px", borderRadius: "5px" }}>{ev.type === "buy" ? "BUY" : "SELL"}</div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: "13px", fontWeight: 700 }}>${ev.tokenSymbol}{ev.solAmount > 0 && <span style={{ ...M, fontSize: "11px", color: "var(--text-muted, #888)", marginLeft: "6px" }}>{ev.solAmount.toFixed(2)} SOL</span>}</div>
                    <div style={{ ...M, fontSize: "9px", color: "var(--text-muted, #aaa)" }}>{ev.tokenMint.slice(0, 8)}..{ev.tokenMint.slice(-4)}</div>
                  </div>
                  <div style={{ textAlign: "right", flexShrink: 0 }}>
                    <div style={{ fontSize: "11px", fontWeight: 600 }}>{ev.walletEmoji} {ev.walletName}</div>
                    <div style={{ ...M, fontSize: "9px", color: "var(--text-muted, #aaa)" }}>{new Date(ev.timestamp).toLocaleString(undefined, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}</div>
                  </div>
                  <a href={`https://solscan.io/tx/${ev.signature}`} target="_blank" rel="noopener" style={{ color: "#9945FF", textDecoration: "none", fontSize: "11px" }}>↗</a>
                </div>
              ))}
              {feedEvents.length > feedLimit && <button onClick={() => setFeedLimit(p => p + 50)} style={{ ...M, padding: "8px", background: "transparent", color: "var(--accent, #9945FF)", border: "1px solid rgba(153,69,255,0.15)", borderRadius: "8px", fontSize: "10px", fontWeight: 600, cursor: "pointer", alignSelf: "center" }}>Load More ({feedEvents.length - feedLimit})</button>}
            </div>
          )}
        </div>
      </div>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
