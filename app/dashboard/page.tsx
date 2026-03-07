"use client";
import { useWallet } from "@solana/wallet-adapter-react";
import { WalletMultiButton } from "@solana/wallet-adapter-react-ui";
import { useConnection } from "@solana/wallet-adapter-react";
import { PublicKey } from "@solana/web3.js";
import { useState, useEffect, useCallback, useRef, useMemo } from "react";

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
function timeAgo(ts: number) { const d = Date.now() - ts; if (d < 60000) return "just now"; if (d < 3600000) return `${Math.floor(d / 60000)}m ago`; if (d < 86400000) return `${Math.floor(d / 3600000)}h ago`; return `${Math.floor(d / 86400000)}d ago`; }
function gc(g: string) { if (g?.startsWith("A")) return "#14F195"; if (g?.startsWith("B")) return "#4ade80"; if (g?.startsWith("C")) return "#eab308"; if (g?.startsWith("D")) return "#f97316"; return "#ef4444"; }

export default function Dashboard() {
  const { publicKey, connected } = useWallet();
  const { connection } = useConnection();
  const [tokenBalance, setTokenBalance] = useState(0);
  const [tab, setTab] = useState<"overview" | "scan" | "watchlist" | "history" | "batch" | "bundlers">("bundlers");
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
  const [feedFilter, setFeedFilter] = useState<string>("all");
  const [historySearch, setHistorySearch] = useState("");
  const [lastFeedUpdate, setLastFeedUpdate] = useState<number | null>(null);
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
      const batches: { address: string; name: string; emoji: string; group: string }[][] = [];
      for (let i = 0; i < bundlers.length; i += 10) {
        batches.push(bundlers.slice(i, i + 10).map(b => ({ address: b.address, name: b.label, emoji: b.emoji || "🚩", group: b.group || "tracked" })));
      }
      const results = await Promise.all(batches.map(batch =>
        fetch("/api/bundler-feed", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ wallets: batch }) })
          .then(r => r.ok ? r.json() : { events: [] }).catch(() => ({ events: [] }))
      ));
      const all: FeedEvent[] = [];
      results.forEach(d => all.push(...(d.events || [])));
      all.sort((a, b) => b.timestamp - a.timestamp);
      setFeedEvents(all);
      setLastFeedUpdate(Date.now());
    } catch {} setFeedLoading(false);
  }, [bundlers]);

  // Auto-load default bundlers on first visit if none saved
  const initRef = useRef(false);
  useEffect(() => {
    if (initRef.current) return; initRef.current = true;
    const saved = localStorage.getItem("holdtech-bundlers");
    if (!saved || JSON.parse(saved).length === 0) {
      fetch("/bundlers-default.json").then(r => r.json()).then(d => {
        const nb = d.map((x: any) => ({ address: x.address, label: x.name, emoji: x.emoji, group: x.group, addedAt: Date.now(), seenIn: [] as string[] }));
        setBundlers(nb); localStorage.setItem("holdtech-bundlers", JSON.stringify(nb));
      }).catch(() => {});
    }
  }, []);

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

  // Feed stats
  const feedGroups = useMemo(() => {
    const groups = new Set(bundlers.map(b => b.group || "tracked"));
    return ["all", ...Array.from(groups)];
  }, [bundlers]);

  const filteredFeed = useMemo(() => {
    if (feedFilter === "all") return feedEvents;
    return feedEvents.filter(ev => ev.walletGroup === feedFilter);
  }, [feedEvents, feedFilter]);

  const feedStats = useMemo(() => {
    const buys = filteredFeed.filter(e => e.type === "buy");
    const sells = filteredFeed.filter(e => e.type === "sell");
    const totalSolBuy = buys.reduce((s, e) => s + e.solAmount, 0);
    const totalSolSell = sells.reduce((s, e) => s + e.solAmount, 0);
    const walletCounts: Record<string, number> = {};
    filteredFeed.forEach(e => { walletCounts[e.walletName] = (walletCounts[e.walletName] || 0) + 1; });
    const mostActive = Object.entries(walletCounts).sort((a, b) => b[1] - a[1])[0];
    const uniqueTokens = new Set(filteredFeed.map(e => e.tokenMint)).size;
    return { buys: buys.length, sells: sells.length, totalSolBuy, totalSolSell, mostActive, uniqueTokens };
  }, [filteredFeed]);

  const filteredHistory = useMemo(() => {
    if (!historySearch.trim()) return history;
    const q = historySearch.toLowerCase();
    return history.filter(h => h.symbol.toLowerCase().includes(q) || h.mint.toLowerCase().includes(q));
  }, [history, historySearch]);

  // ── GATE ──
  if (!isDemo && !connected) {
    return (
      <div style={{ minHeight: "100vh", background: "#f0f0f6", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "var(--font)" }}>
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

  const M: React.CSSProperties = { fontFamily: "'JetBrains Mono', 'Fira Code', 'Courier New', monospace" };

  const tabs = [
    { id: "bundlers" as const, label: "Bundler Feed", icon: "⬡", count: bundlers.length },
    { id: "scan" as const, label: "Scan", icon: "⊕" },
    { id: "overview" as const, label: "Overview", icon: "◫" },
    { id: "watchlist" as const, label: `Watchlist`, icon: "◉", count: watchlist.length },
    { id: "history" as const, label: "History", icon: "◷", count: history.length },
    { id: "batch" as const, label: "Batch", icon: "▤" },
  ];

  // Glass card helper
  const card = (extra?: React.CSSProperties): React.CSSProperties => ({
    background: "var(--card-bg, rgba(255,255,255,0.6))",
    backdropFilter: "blur(16px)",
    WebkitBackdropFilter: "blur(16px)",
    border: "1px solid var(--border, rgba(153,69,255,0.08))",
    borderRadius: "14px",
    ...extra,
  });

  const pill = (active: boolean, color?: string): React.CSSProperties => ({
    ...M,
    padding: "5px 12px",
    borderRadius: "20px",
    border: "none",
    cursor: "pointer",
    fontSize: "10px",
    fontWeight: 700,
    letterSpacing: "0.03em",
    background: active ? `${color || "#9945FF"}15` : "rgba(0,0,0,0.02)",
    color: active ? (color || "#9945FF") : "var(--text-muted, #888)",
    transition: "all 0.2s",
  });

  return (
    <div style={{ minHeight: "100vh", background: "var(--bg, #f0f0f6)", fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif", color: "var(--text, #1a1a2e)" }}>
      {/* Grid bg */}
      <div style={{ position: "fixed", inset: 0, zIndex: 0, pointerEvents: "none", backgroundImage: "linear-gradient(rgba(153,69,255,0.04) 1px, transparent 1px), linear-gradient(90deg, rgba(153,69,255,0.04) 1px, transparent 1px)", backgroundSize: "48px 48px", maskImage: "linear-gradient(to bottom, black 50%, transparent 100%)", WebkitMaskImage: "linear-gradient(to bottom, black 50%, transparent 100%)" }} />

      <div style={{ position: "relative", zIndex: 1, display: "flex", minHeight: "100vh" }}>
        {/* ═══ SIDEBAR ═══ */}
        <div style={{ width: "230px", flexShrink: 0, padding: "20px 14px", display: "flex", flexDirection: "column", gap: "2px", borderRight: "1px solid var(--border, rgba(153,69,255,0.06))", background: "var(--card-bg, rgba(255,255,255,0.25))", backdropFilter: "blur(12px)" }}>
          {/* Logo */}
          <a href="/" style={{ display: "flex", alignItems: "center", gap: "10px", textDecoration: "none", padding: "6px 12px", marginBottom: "20px" }}>
            <img src="/logo.png" alt="" width={28} height={28} style={{ objectFit: "contain" }} />
            <span style={{ fontSize: "17px", fontWeight: 800, letterSpacing: "-0.02em" }}><span style={{ color: "var(--accent, #9945FF)" }}>HOLD</span><span style={{ color: "var(--text-muted, #888)" }}>TECH</span></span>
            <span style={{ ...M, fontSize: "8px", fontWeight: 700, color: "#9945FF", background: "rgba(153,69,255,0.08)", padding: "2px 5px", borderRadius: "4px", marginLeft: "-2px" }}>BETA</span>
          </a>

          {/* Nav tabs */}
          {tabs.map((t, i) => (
            <div key={t.id}>
              {i === 2 && <div style={{ height: "1px", background: "var(--border, rgba(153,69,255,0.06))", margin: "8px 12px" }} />}
              <button onClick={() => setTab(t.id)} style={{
                ...M, display: "flex", alignItems: "center", gap: "10px", padding: "10px 14px",
                borderRadius: "10px", border: "none", cursor: "pointer", fontSize: "11.5px", fontWeight: 600,
                textAlign: "left" as const, width: "100%",
                background: tab === t.id ? "rgba(153,69,255,0.1)" : "transparent",
                color: tab === t.id ? "var(--accent, #9945FF)" : "var(--text-muted, #888)",
                transition: "all 0.15s",
                borderLeft: tab === t.id ? "3px solid var(--accent, #9945FF)" : "3px solid transparent",
              }}>
                <span style={{ fontSize: "13px", width: "18px", textAlign: "center", opacity: tab === t.id ? 1 : 0.6 }}>{t.icon}</span>
                <span style={{ flex: 1 }}>{t.label}</span>
                {t.count !== undefined && t.count > 0 && (
                  <span style={{
                    fontSize: "9px", fontWeight: 700,
                    background: tab === t.id ? "rgba(153,69,255,0.15)" : "rgba(0,0,0,0.04)",
                    padding: "2px 7px", borderRadius: "10px", minWidth: "20px", textAlign: "center",
                  }}>{t.count}</span>
                )}
              </button>
            </div>
          ))}

          <div style={{ flex: 1 }} />

          {/* Wallet + Tier */}
          <div style={{ ...card({ padding: "14px", marginTop: "8px" }) }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "8px" }}>
              <div style={{ ...M, fontSize: "9px", fontWeight: 700, color: tier.color, letterSpacing: "0.1em", textTransform: "uppercase" }}>{tier.icon} {tier.name}</div>
              {isDemo && <span style={{ ...M, fontSize: "8px", color: "#14F195", background: "rgba(20,241,149,0.1)", padding: "2px 6px", borderRadius: "4px" }}>DEMO</span>}
            </div>
            {connected && publicKey ? (
              <div style={{ ...M, fontSize: "10px", color: "var(--text-muted, #888)" }}>
                {publicKey.toBase58().slice(0, 4)}...{publicKey.toBase58().slice(-4)}
              </div>
            ) : (
              <div style={{ ...M, fontSize: "10px", color: "var(--text-muted, #aaa)" }}>No wallet</div>
            )}
            {!isDemo && <div style={{ ...M, fontSize: "10px", color: "var(--text-muted, #888)", marginTop: "4px" }}>{tokenBalance.toLocaleString()} $HOLDTECH</div>}
          </div>

          {/* Bottom controls */}
          <div style={{ display: "flex", gap: "4px", marginTop: "6px" }}>
            <button onClick={toggleTheme} style={{ flex: 1, padding: "9px", borderRadius: "10px", border: "1px solid var(--border, rgba(153,69,255,0.06))", background: "rgba(0,0,0,0.02)", cursor: "pointer", fontSize: "13px", transition: "all 0.15s" }} title={darkMode ? "Light mode" : "Dark mode"}>{darkMode ? "☀️" : "🌙"}</button>
            <a href="/docs" style={{ flex: 1, padding: "9px", borderRadius: "10px", border: "1px solid var(--border, rgba(153,69,255,0.06))", background: "rgba(0,0,0,0.02)", textDecoration: "none", textAlign: "center", fontSize: "10px", fontWeight: 700, color: "var(--text-muted, #888)", display: "flex", alignItems: "center", justifyContent: "center", ...M }}>DOCS</a>
            <a href="/" style={{ flex: 1, padding: "9px", borderRadius: "10px", border: "1px solid var(--border, rgba(153,69,255,0.06))", background: "rgba(0,0,0,0.02)", textDecoration: "none", textAlign: "center", fontSize: "10px", fontWeight: 700, color: "var(--text-muted, #888)", display: "flex", alignItems: "center", justifyContent: "center", ...M }}>HOME</a>
          </div>
        </div>

        {/* ═══ MAIN ═══ */}
        <div style={{ flex: 1, padding: "28px 36px", maxWidth: "900px", minHeight: "100vh" }}>

          {/* ═══ BUNDLER FEED ═══ */}
          {tab === "bundlers" && (
            <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
              {/* Header */}
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <div>
                  <div style={{ ...M, fontSize: "20px", fontWeight: 800, letterSpacing: "-0.02em" }}>Bundler Feed</div>
                  <div style={{ ...M, fontSize: "11px", color: "var(--text-muted, #888)", marginTop: "2px" }}>
                    {bundlers.length} wallets tracked
                    {lastFeedUpdate && <> · updated {timeAgo(lastFeedUpdate)}</>}
                    {autoRefresh && <span style={{ color: "#14F195" }}> · ● LIVE</span>}
                  </div>
                </div>
                <div style={{ display: "flex", gap: "6px", alignItems: "center" }}>
                  <button onClick={() => setAutoRefresh(!autoRefresh)} style={{
                    ...M, padding: "7px 14px", borderRadius: "8px", border: "none", cursor: "pointer",
                    fontSize: "10px", fontWeight: 700, transition: "all 0.2s",
                    background: autoRefresh ? "rgba(20,241,149,0.12)" : "rgba(0,0,0,0.03)",
                    color: autoRefresh ? "#14F195" : "var(--text-muted, #888)",
                    boxShadow: autoRefresh ? "0 0 12px rgba(20,241,149,0.15)" : "none",
                  }}>
                    {autoRefresh ? "● LIVE" : "○ AUTO"}
                  </button>
                  <button onClick={fetchFeed} disabled={feedLoading} style={{
                    ...M, padding: "7px 14px", background: "linear-gradient(135deg, #9945FF, #7B3FE4)",
                    color: "white", border: "none", borderRadius: "8px", fontSize: "10px", fontWeight: 700,
                    cursor: "pointer", opacity: feedLoading ? 0.6 : 1, transition: "opacity 0.2s",
                  }}>{feedLoading ? "Loading..." : "↻ Refresh"}</button>
                  <button onClick={() => setShowManage(!showManage)} style={{
                    ...M, padding: "7px 14px", background: showManage ? "rgba(153,69,255,0.08)" : "rgba(0,0,0,0.03)",
                    color: showManage ? "#9945FF" : "var(--text-muted, #888)",
                    border: "none", borderRadius: "8px", fontSize: "10px", fontWeight: 700, cursor: "pointer",
                  }}>{showManage ? "✕ Close" : "⚙ Manage"}</button>
                </div>
              </div>

              {/* Stats row */}
              {feedEvents.length > 0 && (
                <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: "10px" }}>
                  {[
                    { label: "BUYS", value: feedStats.buys.toString(), color: "#14F195", sub: `${feedStats.totalSolBuy.toFixed(1)} SOL` },
                    { label: "SELLS", value: feedStats.sells.toString(), color: "#ef4444", sub: `${feedStats.totalSolSell.toFixed(1)} SOL` },
                    { label: "TOKENS", value: feedStats.uniqueTokens.toString(), color: "#9945FF", sub: "unique" },
                    { label: "EVENTS", value: filteredFeed.length.toString(), color: "var(--text, #1a1a2e)", sub: feedFilter === "all" ? "total" : feedFilter },
                    { label: "MOST ACTIVE", value: feedStats.mostActive?.[0]?.slice(0, 10) || "—", color: "#9945FF", sub: feedStats.mostActive ? `${feedStats.mostActive[1]} txs` : "" },
                  ].map(s => (
                    <div key={s.label} style={{ ...card({ padding: "12px 14px" }) }}>
                      <div style={{ ...M, fontSize: "8px", fontWeight: 700, color: "var(--text-muted, #999)", letterSpacing: "0.1em" }}>{s.label}</div>
                      <div style={{ ...M, fontSize: "18px", fontWeight: 800, color: s.color, marginTop: "3px", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{s.value}</div>
                      <div style={{ ...M, fontSize: "9px", color: "var(--text-muted, #aaa)", marginTop: "1px" }}>{s.sub}</div>
                    </div>
                  ))}
                </div>
              )}

              {/* Group filter pills */}
              {feedGroups.length > 2 && feedEvents.length > 0 && (
                <div style={{ display: "flex", gap: "6px", flexWrap: "wrap" }}>
                  {feedGroups.map(g => (
                    <button key={g} onClick={() => setFeedFilter(g)} style={pill(feedFilter === g)}>
                      {g === "all" ? "All" : g}
                      {g !== "all" && <span style={{ marginLeft: "4px", opacity: 0.6 }}>({feedEvents.filter(e => e.walletGroup === g).length})</span>}
                    </button>
                  ))}
                </div>
              )}

              {/* Manage panel */}
              {showManage && (
                <div style={{ ...card({ padding: "18px" }) }}>
                  <div style={{ ...M, fontSize: "11px", fontWeight: 700, marginBottom: "12px", color: "var(--text-muted, #888)" }}>MANAGE TRACKED WALLETS</div>
                  <div style={{ display: "flex", gap: "6px", marginBottom: "12px" }}>
                    <input value={bundlerInput} onChange={e => setBundlerInput(e.target.value)} placeholder="Wallet address..." style={{ flex: 2, padding: "9px 12px", border: "1px solid var(--border, rgba(153,69,255,0.12))", borderRadius: "10px", fontSize: "11px", ...M, outline: "none", background: "var(--card-bg, rgba(255,255,255,0.8))", color: "var(--text, #1a1a2e)" }} spellCheck={false} />
                    <input value={bundlerLabel} onChange={e => setBundlerLabel(e.target.value)} placeholder="Label" style={{ flex: 1, padding: "9px 12px", border: "1px solid var(--border, rgba(153,69,255,0.12))", borderRadius: "10px", fontSize: "11px", ...M, outline: "none", background: "var(--card-bg, rgba(255,255,255,0.8))", color: "var(--text, #1a1a2e)" }} />
                    <button onClick={() => { const a = bundlerInput.trim(); if (!a || a.length < 32 || bundlers.find(b => b.address === a)) return; const n = [...bundlers, { address: a, label: bundlerLabel.trim() || a.slice(0, 8), emoji: "🚩", group: "custom", addedAt: Date.now(), seenIn: [] as string[] }]; setBundlers(n); localStorage.setItem("holdtech-bundlers", JSON.stringify(n)); setBundlerInput(""); setBundlerLabel(""); }} style={{ ...M, padding: "9px 16px", background: "linear-gradient(135deg, #9945FF, #7B3FE4)", color: "white", border: "none", borderRadius: "10px", fontSize: "10px", fontWeight: 700, cursor: "pointer" }}>ADD</button>
                  </div>
                  <div style={{ display: "flex", gap: "6px", marginBottom: "12px" }}>
                    <button onClick={loadDefaults} style={pill(false)}>Load Defaults ({bundlers.length > 0 ? "merge" : "49"})</button>
                    <button onClick={() => navigator.clipboard.writeText(JSON.stringify(bundlers.map(b => ({ address: b.address, label: b.label, emoji: b.emoji, group: b.group })), null, 2))} style={pill(false)}>Export JSON</button>
                  </div>
                  <textarea id="imp-json" placeholder='Paste JSON array or one address per line...' style={{ width: "100%", padding: "10px", border: "1px solid var(--border, rgba(153,69,255,0.1))", borderRadius: "10px", fontSize: "10px", ...M, outline: "none", minHeight: "50px", resize: "vertical", background: "var(--card-bg, rgba(255,255,255,0.8))", color: "var(--text, #1a1a2e)" }} spellCheck={false} />
                  <button onClick={() => { const el = document.getElementById("imp-json") as HTMLTextAreaElement; if (!el?.value.trim()) return; const ex = new Set(bundlers.map(b => b.address)); let nw: any[] = []; try { const p = JSON.parse(el.value); if (Array.isArray(p)) nw = p.filter((d: any) => !ex.has(d.trackedWalletAddress || d.address)).map((d: any) => ({ address: d.trackedWalletAddress || d.address, label: d.name || d.label || "—", emoji: d.emoji || "🚩", group: d.groups?.[0] || d.groupNames?.[0] || d.group || "imported", addedAt: Date.now(), seenIn: [] as string[] })); } catch { nw = el.value.split(/[\n,]+/).map(s => s.trim()).filter(s => s.length >= 32 && !ex.has(s)).map(a => ({ address: a, label: a.slice(0, 8), emoji: "🚩", group: "imported", addedAt: Date.now(), seenIn: [] as string[] })); } if (nw.length) { const nb = [...bundlers, ...nw]; setBundlers(nb); localStorage.setItem("holdtech-bundlers", JSON.stringify(nb)); el.value = ""; } }} style={{ ...M, padding: "7px 14px", background: "linear-gradient(135deg, #9945FF, #7B3FE4)", color: "white", border: "none", borderRadius: "8px", fontSize: "10px", fontWeight: 700, cursor: "pointer", marginTop: "8px" }}>IMPORT</button>

                  {/* Wallet list */}
                  <div style={{ maxHeight: "200px", overflow: "auto", marginTop: "14px", borderTop: "1px solid var(--border, rgba(0,0,0,0.04))", paddingTop: "8px" }}>
                    {bundlers.map(b => (
                      <div key={b.address} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "5px 2px", fontSize: "11px", borderBottom: "1px solid rgba(0,0,0,0.02)", transition: "background 0.1s" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                          <span style={{ fontSize: "13px" }}>{b.emoji}</span>
                          <span style={{ fontWeight: 600 }}>{b.label}</span>
                          <span style={{ ...M, fontSize: "9px", color: "var(--text-muted, #aaa)" }}>{b.address.slice(0, 6)}..{b.address.slice(-4)}</span>
                          {b.group && <span style={{ ...M, fontSize: "8px", color: "#9945FF", background: "rgba(153,69,255,0.06)", padding: "1px 5px", borderRadius: "4px" }}>{b.group}</span>}
                        </div>
                        <button onClick={() => { const n = bundlers.filter(x => x.address !== b.address); setBundlers(n); localStorage.setItem("holdtech-bundlers", JSON.stringify(n)); }} style={{ background: "none", border: "none", cursor: "pointer", color: "#ccc", fontSize: "14px", padding: "2px 6px", borderRadius: "4px", transition: "color 0.15s" }}>×</button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Empty state */}
              {bundlers.length === 0 && (
                <div style={{ ...card({ padding: "60px 40px", textAlign: "center" }) }}>
                  <div style={{ fontSize: "36px", marginBottom: "14px", opacity: 0.3 }}>⬡</div>
                  <div style={{ fontSize: "15px", fontWeight: 700, marginBottom: "6px" }}>No bundler wallets tracked</div>
                  <div style={{ fontSize: "12px", color: "var(--text-muted, #888)", marginBottom: "20px" }}>Load the default rugger list or add your own wallets to start monitoring</div>
                  <button onClick={loadDefaults} style={{ ...M, padding: "12px 28px", background: "linear-gradient(135deg, #9945FF, #7B3FE4)", color: "white", border: "none", borderRadius: "12px", fontSize: "12px", fontWeight: 700, cursor: "pointer", boxShadow: "0 4px 16px rgba(153,69,255,0.2)" }}>Load Default Ruggers (49)</button>
                </div>
              )}

              {/* Skeleton loading */}
              {feedLoading && feedEvents.length === 0 && (
                <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                  {Array.from({ length: 6 }).map((_, i) => (
                    <div key={i} style={{ ...card({ padding: "14px 16px", display: "flex", alignItems: "center", gap: "12px" }), animation: "pulse 1.5s ease-in-out infinite", opacity: 1 - i * 0.12 }}>
                      <div style={{ width: 40, height: 40, borderRadius: "10px", background: "rgba(153,69,255,0.06)" }} />
                      <div style={{ width: 40, height: 18, borderRadius: "4px", background: "rgba(153,69,255,0.04)" }} />
                      <div style={{ flex: 1 }}>
                        <div style={{ width: "40%", height: 14, borderRadius: "4px", background: "rgba(153,69,255,0.06)", marginBottom: "6px" }} />
                        <div style={{ width: "60%", height: 10, borderRadius: "3px", background: "rgba(153,69,255,0.03)" }} />
                      </div>
                      <div style={{ width: 80, height: 14, borderRadius: "4px", background: "rgba(153,69,255,0.04)" }} />
                    </div>
                  ))}
                </div>
              )}

              {/* Transaction count */}
              {filteredFeed.length > 0 && !feedLoading && (
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <div style={{ ...M, fontSize: "10px", color: "var(--text-muted, #888)" }}>
                    Showing {Math.min(feedLimit, filteredFeed.length)} of {filteredFeed.length} transactions
                  </div>
                  {feedLoading && <div style={{ ...M, fontSize: "10px", color: "#9945FF" }}>Updating...</div>}
                </div>
              )}

              {/* Feed items */}
              {filteredFeed.slice(0, feedLimit).map((ev, i) => (
                <div key={`${ev.signature}-${i}`} style={{
                  ...card({ padding: "12px 16px", display: "flex", alignItems: "center", gap: "12px" }),
                  borderLeft: `3px solid ${ev.type === "buy" ? "rgba(20,241,149,0.4)" : "rgba(239,68,68,0.3)"}`,
                  transition: "transform 0.1s, box-shadow 0.15s",
                }}>
                  {/* Token image */}
                  <div style={{ width: 42, height: 42, borderRadius: "10px", overflow: "hidden", flexShrink: 0, background: "rgba(153,69,255,0.03)", display: "flex", alignItems: "center", justifyContent: "center", border: "1px solid rgba(153,69,255,0.06)" }}>
                    {ev.tokenImage ? <img src={ev.tokenImage} alt="" width={42} height={42} style={{ objectFit: "cover" }} onError={e => { (e.target as HTMLImageElement).style.display = "none"; }} /> : <span style={{ fontSize: "18px", opacity: 0.2 }}>🪙</span>}
                  </div>

                  {/* Buy/Sell badge */}
                  <div style={{
                    ...M, fontSize: "9px", fontWeight: 800, padding: "4px 10px", borderRadius: "6px",
                    color: ev.type === "buy" ? "#14F195" : "#ef4444",
                    background: ev.type === "buy" ? "rgba(20,241,149,0.1)" : "rgba(239,68,68,0.08)",
                    minWidth: "36px", textAlign: "center",
                  }}>{ev.type === "buy" ? "BUY" : "SELL"}</div>

                  {/* Token info */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: "flex", alignItems: "baseline", gap: "8px" }}>
                      <span style={{ fontSize: "14px", fontWeight: 700 }}>${ev.tokenSymbol}</span>
                      {ev.solAmount > 0 && (
                        <span style={{
                          ...M, fontSize: "13px", fontWeight: 800,
                          color: ev.type === "buy" ? "#14F195" : "#ef4444",
                        }}>{ev.solAmount.toFixed(2)} SOL</span>
                      )}
                    </div>
                    <div style={{ ...M, fontSize: "9px", color: "var(--text-muted, #aaa)", marginTop: "2px" }}>
                      {ev.tokenMint.slice(0, 8)}..{ev.tokenMint.slice(-4)}
                    </div>
                  </div>

                  {/* Wallet info */}
                  <div style={{ textAlign: "right", flexShrink: 0 }}>
                    <div style={{ fontSize: "11px", fontWeight: 600, display: "flex", alignItems: "center", gap: "4px", justifyContent: "flex-end" }}>
                      <span style={{ fontSize: "13px" }}>{ev.walletEmoji}</span>
                      <span>{ev.walletName}</span>
                    </div>
                    <div style={{ ...M, fontSize: "9px", color: "var(--text-muted, #aaa)", marginTop: "2px" }}>
                      {new Date(ev.timestamp).toLocaleString(undefined, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
                    </div>
                  </div>

                  {/* Links */}
                  <div style={{ display: "flex", flexDirection: "column", gap: "4px", flexShrink: 0 }}>
                    <a href={`https://solscan.io/tx/${ev.signature}`} target="_blank" rel="noopener" style={{ ...M, color: "#9945FF", textDecoration: "none", fontSize: "10px", opacity: 0.6, transition: "opacity 0.15s" }} title="View on Solscan">TX ↗</a>
                    <a href={`/?mint=${ev.tokenMint}`} target="_blank" rel="noopener" style={{ ...M, color: "#9945FF", textDecoration: "none", fontSize: "10px", opacity: 0.6, transition: "opacity 0.15s" }} title="Scan token">SCAN</a>
                  </div>
                </div>
              ))}

              {/* Load more */}
              {filteredFeed.length > feedLimit && (
                <button onClick={() => setFeedLimit(p => p + 50)} style={{
                  ...M, padding: "10px", background: "transparent",
                  color: "var(--accent, #9945FF)", border: "1px solid rgba(153,69,255,0.15)",
                  borderRadius: "10px", fontSize: "11px", fontWeight: 600, cursor: "pointer", alignSelf: "center",
                  width: "100%", transition: "background 0.15s",
                }}>Load More ({filteredFeed.length - feedLimit} remaining)</button>
              )}

              {/* No results after filter */}
              {feedEvents.length > 0 && filteredFeed.length === 0 && (
                <div style={{ ...card({ padding: "40px", textAlign: "center" }) }}>
                  <div style={{ ...M, fontSize: "12px", color: "var(--text-muted, #888)" }}>No transactions for "{feedFilter}" group</div>
                </div>
              )}
            </div>
          )}

          {/* ═══ OVERVIEW ═══ */}
          {tab === "overview" && (
            <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
              <div style={{ ...M, fontSize: "20px", fontWeight: 800, letterSpacing: "-0.02em" }}>Dashboard</div>

              {/* Stat cards */}
              <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "12px" }}>
                {[
                  { label: "Total Scans", value: history.length.toString(), sub: "all time" },
                  { label: "Avg Score", value: avgScore ? `${avgScore}/100` : "—", sub: history.length > 0 ? `across ${history.length} scans` : "no data" },
                  { label: "Watching", value: watchlist.length.toString(), sub: `of ${tier.name === "FREE" ? 3 : tier.name === "SCOUT" ? 10 : tier.name === "OPERATOR" ? 50 : 200} slots` },
                  { label: "Bundlers", value: bundlers.length.toString(), sub: "wallets tracked" },
                ].map(s => (
                  <div key={s.label} style={{ ...card({ padding: "16px" }) }}>
                    <div style={{ ...M, fontSize: "8px", fontWeight: 700, color: "var(--text-muted, #999)", letterSpacing: "0.1em", textTransform: "uppercase" }}>{s.label}</div>
                    <div style={{ ...M, fontSize: "24px", fontWeight: 800, marginTop: "4px" }}>{s.value}</div>
                    <div style={{ fontSize: "10px", color: "var(--text-muted, #aaa)", marginTop: "2px" }}>{s.sub}</div>
                  </div>
                ))}
              </div>

              {/* Grade distribution */}
              {history.length > 0 && (
                <div style={{ ...card({ padding: "20px" }) }}>
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
                <div style={{ ...card({ padding: "20px" }) }}>
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
                <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                  {bestScan && (
                    <div style={{ ...card({ padding: "16px", borderColor: "rgba(20,241,149,0.15)" }) }}>
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
                    <div style={{ ...card({ padding: "16px", borderColor: "rgba(239,68,68,0.12)" }) }}>
                      <div style={{ ...M, fontSize: "9px", fontWeight: 700, color: "#ef4444", letterSpacing: "0.08em" }}>RISKIEST TOKEN</div>
                      <div style={{ display: "flex", alignItems: "center", gap: "10px", marginTop: "8px" }}>
                        <span style={{ ...M, fontSize: "24px", fontWeight: 800, color: gc(worstScan.grade) }}>{worstScan.grade}</span>
                        <div>
                          <div style={{ fontSize: "14px", fontWeight: 700 }}>{worstScan.symbol}</div>
                          <div style={{ ...M, fontSize: "10px", color: "var(--text-muted, #888)" }}>{worstScan.score}/100 · {worstScan.freshPct}% fresh</div>
                        </div>
                      </div>
                    </div>
                  )}
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px" }}>
                    <button onClick={() => setTab("scan")} style={{ ...card({ padding: "14px", cursor: "pointer", border: "1px solid var(--border, rgba(153,69,255,0.12))" }), ...M, fontSize: "11px", fontWeight: 700, color: "var(--accent, #9945FF)", textAlign: "left" as const }}>⊕ New Scan</button>
                    <button onClick={() => setTab("bundlers")} style={{ ...card({ padding: "14px", cursor: "pointer", border: "1px solid var(--border, rgba(153,69,255,0.12))" }), ...M, fontSize: "11px", fontWeight: 700, color: "var(--text-muted, #888)", textAlign: "left" as const }}>⬡ Bundler Feed</button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ═══ SCAN ═══ */}
          {tab === "scan" && (
            <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
              <div style={{ ...M, fontSize: "20px", fontWeight: 800, letterSpacing: "-0.02em" }}>Scan Token</div>
              <div style={{ display: "flex", gap: "8px" }}>
                <input value={scanInput} onChange={e => setScanInput(e.target.value)} onKeyDown={e => e.key === "Enter" && handleScan()} placeholder="Paste token mint address..." style={{ flex: 1, padding: "13px 16px", border: "1px solid var(--border, rgba(153,69,255,0.15))", borderRadius: "12px", fontSize: "13px", background: "var(--card-bg, rgba(255,255,255,0.8))", ...M, outline: "none", color: "var(--text, #1a1a2e)", transition: "border-color 0.15s" }} spellCheck={false} />
                <button onClick={handleScan} disabled={scanning} style={{ ...M, padding: "13px 28px", background: "linear-gradient(135deg, #9945FF, #7B3FE4)", color: "white", border: "none", borderRadius: "12px", fontSize: "12px", fontWeight: 700, cursor: "pointer", opacity: scanning ? 0.5 : 1, boxShadow: "0 4px 16px rgba(153,69,255,0.2)", transition: "opacity 0.15s" }}>{scanning ? progress || "..." : "SCAN"}</button>
              </div>
              {scanning && (
                <div style={{ ...card({ padding: "40px", textAlign: "center" }) }}>
                  <div style={{ display: "inline-block", width: 32, height: 32, border: "3px solid rgba(153,69,255,0.12)", borderTopColor: "#9945FF", borderRadius: "50%", animation: "spin 1s linear infinite", marginBottom: "12px" }} />
                  <div style={{ ...M, fontSize: "12px", color: "var(--text-muted, #888)" }}>{progress}</div>
                </div>
              )}
              {scanResult && (
                <div style={{ ...card({ padding: "24px" }) }}>
                  <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: "20px" }}>
                    <div>
                      <div style={{ fontSize: "22px", fontWeight: 800 }}>{scanResult.symbol}</div>
                      <div style={{ ...M, fontSize: "11px", color: "var(--text-muted, #888)", marginTop: "2px" }}>{scanResult.mint}</div>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                      <button onClick={() => addWatch(scanResult)} style={{ ...M, padding: "7px 16px", background: "transparent", color: "var(--accent, #9945FF)", border: "1px solid rgba(153,69,255,0.2)", borderRadius: "8px", fontSize: "11px", fontWeight: 600, cursor: "pointer", transition: "background 0.15s" }}>+ Watch</button>
                      <a href={`/?mint=${scanResult.mint}`} target="_blank" style={{ ...M, padding: "7px 16px", background: "transparent", color: "var(--accent, #9945FF)", border: "1px solid rgba(153,69,255,0.2)", borderRadius: "8px", fontSize: "11px", fontWeight: 600, textDecoration: "none" }}>Full Report →</a>
                      <div style={{ ...M, fontSize: "36px", fontWeight: 800, color: gc(scanResult.grade), background: `${gc(scanResult.grade)}12`, padding: "4px 20px", borderRadius: "14px" }}>{scanResult.grade}</div>
                    </div>
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: "10px" }}>
                    {[{ l: "Score", v: `${scanResult.score}/100` }, { l: "Holders", v: scanResult.holders.toLocaleString() }, { l: "Top 5", v: `${scanResult.top5Pct}%` }, { l: "Fresh", v: `${scanResult.freshPct}%` }, { l: "Avg Age", v: `${scanResult.avgAge}d` }].map(m => (
                      <div key={m.l} style={{ background: "rgba(153,69,255,0.03)", borderRadius: "12px", padding: "14px" }}>
                        <div style={{ ...M, fontSize: "8px", fontWeight: 700, color: "var(--text-muted, #888)", letterSpacing: "0.1em", textTransform: "uppercase" }}>{m.l}</div>
                        <div style={{ ...M, fontSize: "22px", fontWeight: 800, marginTop: "4px" }}>{m.v}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ═══ WATCHLIST ═══ */}
          {tab === "watchlist" && (
            <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "4px" }}>
                <div style={{ ...M, fontSize: "20px", fontWeight: 800, letterSpacing: "-0.02em" }}>Watchlist</div>
                <span style={{ ...M, fontSize: "11px", color: "var(--text-muted, #888)", background: "rgba(0,0,0,0.03)", padding: "4px 10px", borderRadius: "6px" }}>{watchlist.length}/{tier.name === "FREE" ? 3 : tier.name === "SCOUT" ? 10 : tier.name === "OPERATOR" ? 50 : 200} · {tier.name}</span>
              </div>
              {watchlist.length === 0 && (
                <div style={{ ...card({ padding: "60px", textAlign: "center" }) }}>
                  <div style={{ fontSize: "36px", marginBottom: "10px", opacity: 0.3 }}>◉</div>
                  <div style={{ fontSize: "14px", fontWeight: 600, marginBottom: "4px" }}>No tokens watched</div>
                  <div style={{ fontSize: "12px", color: "var(--text-muted, #888)" }}>Scan a token and click &quot;+ Watch&quot; to track it</div>
                </div>
              )}
              {watchlist.map(w => (
                <div key={w.mint} style={{ ...card({ padding: "16px 20px", display: "flex", alignItems: "center", justifyContent: "space-between" }), transition: "transform 0.1s" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "14px" }}>
                    <span style={{ ...M, fontSize: "26px", fontWeight: 800, color: gc(w.lastGrade), minWidth: "36px" }}>{w.lastGrade}</span>
                    <div>
                      <div style={{ fontSize: "15px", fontWeight: 700 }}>{w.symbol}</div>
                      <div style={{ ...M, fontSize: "10px", color: "var(--text-muted, #888)" }}>{w.lastScore}/100 · {w.lastHolders.toLocaleString()} holders · added {timeAgo(w.addedAt)}</div>
                    </div>
                  </div>
                  <div style={{ display: "flex", gap: "6px" }}>
                    <button onClick={() => { setScanInput(w.mint); setTab("scan"); }} style={{ ...M, padding: "7px 14px", background: "rgba(153,69,255,0.06)", color: "var(--accent, #9945FF)", border: "none", borderRadius: "8px", fontSize: "10px", fontWeight: 700, cursor: "pointer", transition: "background 0.15s" }}>Rescan</button>
                    <button onClick={() => rmWatch(w.mint)} style={{ ...M, padding: "7px 14px", background: "rgba(239,68,68,0.04)", color: "#ef4444", border: "none", borderRadius: "8px", fontSize: "10px", fontWeight: 700, cursor: "pointer" }}>Remove</button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* ═══ HISTORY ═══ */}
          {tab === "history" && (
            <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "4px" }}>
                <div style={{ ...M, fontSize: "20px", fontWeight: 800, letterSpacing: "-0.02em" }}>Scan History</div>
                <div style={{ display: "flex", gap: "6px", alignItems: "center" }}>
                  {history.length > 0 && (
                    <>
                      <input value={historySearch} onChange={e => setHistorySearch(e.target.value)} placeholder="Search..." style={{ padding: "6px 12px", border: "1px solid var(--border, rgba(153,69,255,0.1))", borderRadius: "8px", fontSize: "11px", ...M, outline: "none", background: "var(--card-bg, rgba(255,255,255,0.8))", color: "var(--text, #1a1a2e)", width: "160px" }} />
                      <button onClick={() => { setHistory([]); localStorage.removeItem("holdtech-history"); }} style={{ ...M, padding: "6px 12px", background: "rgba(239,68,68,0.04)", color: "#ef4444", border: "none", borderRadius: "8px", fontSize: "10px", fontWeight: 600, cursor: "pointer" }}>Clear All</button>
                    </>
                  )}
                </div>
              </div>
              {history.length === 0 && (
                <div style={{ ...card({ padding: "60px", textAlign: "center" }) }}>
                  <div style={{ fontSize: "36px", marginBottom: "10px", opacity: 0.3 }}>◷</div>
                  <div style={{ fontSize: "14px", fontWeight: 600, marginBottom: "4px" }}>No scans yet</div>
                  <div style={{ fontSize: "12px", color: "var(--text-muted, #888)" }}>Scan your first token to start building history</div>
                </div>
              )}
              {filteredHistory.length > 0 && (
                <div style={{ display: "grid", gridTemplateColumns: "36px 1fr 64px 64px 56px 56px 72px", gap: "6px", padding: "6px 16px", ...M, fontSize: "8px", color: "var(--text-muted, #888)", letterSpacing: "0.08em", textTransform: "uppercase" as const, fontWeight: 700 }}>
                  <span></span><span>Token</span><span>Score</span><span>Holders</span><span>Top 5</span><span>Fresh</span><span>When</span>
                </div>
              )}
              {filteredHistory.map((h, i) => (
                <div key={h.mint + i} onClick={() => { setScanInput(h.mint); setTab("scan"); }} style={{
                  ...card({ display: "grid", gridTemplateColumns: "36px 1fr 64px 64px 56px 56px 72px", gap: "6px", alignItems: "center", padding: "11px 16px", cursor: "pointer" }),
                  transition: "transform 0.1s, border-color 0.15s",
                }}>
                  <span style={{ ...M, fontSize: "16px", fontWeight: 800, color: gc(h.grade) }}>{h.grade}</span>
                  <div><div style={{ fontSize: "12px", fontWeight: 600 }}>{h.symbol}</div><div style={{ ...M, fontSize: "9px", color: "var(--text-muted, #aaa)" }}>{h.mint.slice(0, 6)}..{h.mint.slice(-4)}</div></div>
                  <span style={{ ...M, fontSize: "13px", fontWeight: 700 }}>{h.score}</span>
                  <span style={{ ...M, fontSize: "11px", color: "var(--text-secondary, #666)" }}>{h.holders.toLocaleString()}</span>
                  <span style={{ ...M, fontSize: "11px", color: "var(--text-secondary, #666)" }}>{h.top5Pct}%</span>
                  <span style={{ ...M, fontSize: "11px", color: h.freshPct > 40 ? "#ef4444" : "var(--text-secondary, #666)" }}>{h.freshPct}%</span>
                  <span style={{ ...M, fontSize: "10px", color: "var(--text-muted, #aaa)" }}>{timeAgo(h.timestamp)}</span>
                </div>
              ))}
              {historySearch && filteredHistory.length === 0 && history.length > 0 && (
                <div style={{ ...card({ padding: "30px", textAlign: "center" }) }}>
                  <div style={{ ...M, fontSize: "12px", color: "var(--text-muted, #888)" }}>No results for &quot;{historySearch}&quot;</div>
                </div>
              )}
            </div>
          )}

          {/* ═══ BATCH ═══ */}
          {tab === "batch" && (
            <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
              <div style={{ ...M, fontSize: "20px", fontWeight: 800, letterSpacing: "-0.02em" }}>Batch Scan</div>
              <div style={{ ...card({ padding: "20px" }) }}>
                <div style={{ fontSize: "12px", color: "var(--text-muted, #888)", marginBottom: "12px" }}>Paste multiple addresses — max {tier.name === "FREE" ? 2 : tier.name === "SCOUT" ? 5 : tier.name === "OPERATOR" ? 20 : 50} per batch ({tier.name} tier)</div>
                <textarea value={batchInput} onChange={e => setBatchInput(e.target.value)} placeholder="One per line or comma-separated..." style={{ width: "100%", padding: "14px", border: "1px solid var(--border, rgba(153,69,255,0.12))", borderRadius: "12px", fontSize: "12px", background: "var(--card-bg, rgba(255,255,255,0.8))", ...M, outline: "none", minHeight: "120px", resize: "vertical", color: "var(--text, #1a1a2e)" }} spellCheck={false} />
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: "14px" }}>
                  <span style={{ ...M, fontSize: "11px", color: "var(--text-muted, #888)" }}>{batchInput.split(/[\n,]+/).filter(s => s.trim().length > 30).length} tokens detected</span>
                  <button onClick={handleBatch} disabled={batchScanning} style={{ ...M, padding: "11px 24px", background: "linear-gradient(135deg, #9945FF, #7B3FE4)", color: "white", border: "none", borderRadius: "10px", fontSize: "11px", fontWeight: 700, cursor: "pointer", opacity: batchScanning ? 0.5 : 1, boxShadow: "0 4px 16px rgba(153,69,255,0.2)" }}>{batchScanning ? `Scanning ${progress}` : "SCAN ALL"}</button>
                </div>
              </div>
              {batchResults.length > 0 && [...batchResults].sort((a, b) => b.score - a.score).map((r) => (
                <div key={r.mint} style={{ ...card({ display: "flex", alignItems: "center", gap: "14px", padding: "14px 18px" }) }}>
                  <span style={{ ...M, fontSize: "22px", fontWeight: 800, color: gc(r.grade), minWidth: "36px" }}>{r.grade}</span>
                  <div style={{ flex: 1 }}><span style={{ fontSize: "14px", fontWeight: 700 }}>{r.symbol}</span></div>
                  <span style={{ ...M, fontSize: "13px", fontWeight: 700 }}>{r.score}/100</span>
                  <span style={{ ...M, fontSize: "11px", color: "var(--text-secondary, #666)" }}>{r.holders.toLocaleString()}</span>
                  <span style={{ ...M, fontSize: "11px", color: "var(--text-secondary, #666)" }}>{r.top5Pct}%</span>
                  <a href={`/?mint=${r.mint}`} target="_blank" style={{ ...M, fontSize: "11px", color: "#9945FF", textDecoration: "none", padding: "4px 10px", background: "rgba(153,69,255,0.06)", borderRadius: "6px" }}>Full →</a>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.5; } }
        @import url('https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500;600;700;800&display=swap');
        ::-webkit-scrollbar { width: 6px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: rgba(153,69,255,0.15); border-radius: 3px; }
        ::-webkit-scrollbar-thumb:hover { background: rgba(153,69,255,0.25); }
      `}</style>
    </div>
  );
}
