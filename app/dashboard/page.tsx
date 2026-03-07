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

interface ScanMetrics {
  freshWalletPct: number; veryFreshWalletPct: number; veteranHolderPct: number; ogHolderPct: number;
  lowActivityPct: number; singleTokenPct: number; avgWalletAgeDays: number; medianWalletAgeDays: number;
  avgTxCount: number; avgSolBalance: number; diamondHandsPct: number;
}
interface DistBucket { label: string; count: number; pct: number; }
interface TopHolder { address: string; balancePct: number; walletAgeDays: number; holdDurationDays: number; totalTxCount: number; isFresh: boolean; isPool?: boolean; }
interface ScanVerdict { score: number; grade: string; verdict: string; flags: string[]; }
interface ScanResult {
  mint: string; symbol: string; score: number; grade: string;
  holders: number; top5Pct: number; freshPct: number; avgAge: number; timestamp: number;
  metrics?: ScanMetrics; distribution?: { walletAge: DistBucket[]; holdDuration: DistBucket[]; };
  topHolders?: TopHolder[]; verdict?: ScanVerdict; tokenImage?: string;
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
interface TokenPrice {
  priceUsd: number | null; mc: number | null;
  change5m: number | null; change1h: number | null; change6h: number | null; change24h: number | null;
  volume24h: number | null; pairAddress: string | null;
}
interface CoordinatedAlert {
  tokenMint: string; tokenSymbol: string; tokenImage: string;
  wallets: { name: string; emoji: string; type: string; solAmount: number; timestamp: number }[];
  totalSol: number; firstSeen: number;
}

function getTier(b: number) { let t = TIERS[0]; for (const x of TIERS) { if (b >= x.min) t = x; } return t; }
function timeAgo(ts: number) { const d = Date.now() - ts; if (d < 60000) return "just now"; if (d < 3600000) return `${Math.floor(d / 60000)}m ago`; if (d < 86400000) return `${Math.floor(d / 3600000)}h ago`; return `${Math.floor(d / 86400000)}d ago`; }
function gc(g: string) { if (g?.startsWith("A")) return "#14F195"; if (g?.startsWith("B")) return "#4ade80"; if (g?.startsWith("C")) return "#eab308"; if (g?.startsWith("D")) return "#f97316"; return "#ef4444"; }
function fmtMc(n: number | null) { if (!n) return "—"; if (n >= 1e6) return `$${(n / 1e6).toFixed(1)}M`; if (n >= 1e3) return `$${(n / 1e3).toFixed(0)}K`; return `$${n.toFixed(0)}`; }
function chgColor(v: number | null) { if (v === null) return "var(--text-muted, #888)"; return v >= 0 ? "#14F195" : "#ef4444"; }

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
  const [tokenPrices, setTokenPrices] = useState<Record<string, TokenPrice>>({});
  const [expandedFeedItem, setExpandedFeedItem] = useState<string | null>(null);
  const [inlineScanResult, setInlineScanResult] = useState<ScanResult | null>(null);
  const [inlineScanning, setInlineScanning] = useState(false);
  const [newEventIds, setNewEventIds] = useState<Set<string>>(new Set());
  const [mobileNav, setMobileNav] = useState(false);
  const [notifySound, setNotifySound] = useState(false);
  const historyRef = useRef(history); historyRef.current = history;
  const intervalRef = useRef<any>(null);
  const prevEventCountRef = useRef(0);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Init audio
  useEffect(() => {
    audioRef.current = new Audio("data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdH2LkZeWj4N2aWBdYm1+jJeioJ6Sh3lsYl1hbHuMm6Sin5OFd2piXWJvfoyaoqGdkYV3amFdYm5+jJqioJ2RhXdqYV1ibn6MmqKgnZGFd2phXWJufoyaoqCdkYV3amFdYm5+jJqioJ2RhQ==");
  }, []);

  useEffect(() => {
    try {
      setHistory(JSON.parse(localStorage.getItem("holdtech-history") || "[]"));
      setWatchlist(JSON.parse(localStorage.getItem("holdtech-watchlist") || "[]"));
      setBundlers(JSON.parse(localStorage.getItem("holdtech-bundlers") || "[]"));
      const theme = localStorage.getItem("holdtech-theme");
      if (theme === "dark") { setDarkMode(true); document.documentElement.setAttribute("data-theme", "dark"); }
      setNotifySound(localStorage.getItem("holdtech-notify") === "true");
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
      const aR = await fetch("/api/analyze", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ mint }) });
      if (!aR.ok) return null;
      const a = await aR.json();
      // Fetch holder count + token image in parallel
      let holderCount: number | null = null;
      let tokenImage: string | undefined;
      try {
        const [cR, imgR] = await Promise.all([
          fetch("/api/holder-count", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ mint }) }),
          fetch(`https://api.dexscreener.com/latest/dex/tokens/${mint}`).catch(() => null),
        ]);
        if (cR.ok) { const c = await cR.json(); holderCount = c.holderCount || c.count || null; }
        if (imgR?.ok) { const d = await imgR.json(); const p = d.pairs?.[0]; tokenImage = p?.info?.imageUrl || p?.baseToken?.imageUrl || undefined; }
      } catch {}
      const w = a.wallets || []; const supply = a.totalSupply || 1;
      const top5 = w.slice(0, 5).reduce((s: number, x: any) => s + (x.balance || 0), 0);
      const totalHolders = holderCount || (a.totalHolders > a.analyzedHolders ? a.totalHolders : null) || a.analyzedHolders;
      const vR = await fetch("/api/ai-verdict", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ metrics: a.metrics, totalHolders, analyzedHolders: a.analyzedHolders, tokenSymbol: a.tokenSymbol }) });
      const v = vR.ok ? await vR.json() : null;
      return {
        mint, symbol: a.tokenSymbol || mint.slice(0, 6), score: v?.score ?? 0, grade: v?.grade || "?",
        holders: totalHolders, top5Pct: parseFloat(((top5 / supply) * 100).toFixed(1)),
        freshPct: a.metrics?.freshWalletPct ?? 0, avgAge: Math.round(a.metrics?.avgWalletAgeDays ?? 0),
        timestamp: Date.now(), metrics: a.metrics || undefined, distribution: a.distribution || undefined,
        topHolders: a.topHolders || undefined, verdict: v || undefined, tokenImage,
      };
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

  // Fetch token prices for feed
  const fetchPrices = useCallback(async (events: FeedEvent[]) => {
    const mints = [...new Set(events.map(e => e.tokenMint).filter(Boolean))].slice(0, 30);
    if (mints.length === 0) return;
    try {
      const r = await fetch("/api/token-prices", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ mints }) });
      if (r.ok) { const d = await r.json(); setTokenPrices(d.prices || {}); }
    } catch {}
  }, []);

  const fetchFeed = useCallback(async () => {
    if (bundlers.length === 0) return; setFeedLoading(true);
    try {
      const batches: { address: string; name: string; emoji: string; group: string }[][] = [];
      for (let i = 0; i < bundlers.length; i += 25) {
        batches.push(bundlers.slice(i, i + 25).map(b => ({ address: b.address, name: b.label, emoji: b.emoji || "🚩", group: b.group || "tracked" })));
      }
      const results = await Promise.all(batches.map(batch =>
        fetch("/api/bundler-feed", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ wallets: batch }) })
          .then(r => r.ok ? r.json() : { events: [] }).catch(() => ({ events: [] }))
      ));
      const all: FeedEvent[] = [];
      results.forEach(d => all.push(...(d.events || [])));
      all.sort((a, b) => b.timestamp - a.timestamp);

      // Detect new events for flash animation
      if (prevEventCountRef.current > 0 && all.length > prevEventCountRef.current) {
        const newSigs = new Set(all.slice(0, all.length - prevEventCountRef.current).map(e => e.signature));
        setNewEventIds(newSigs);
        if (notifySound && audioRef.current) {
          try { audioRef.current.play(); } catch {}
        }
        setTimeout(() => setNewEventIds(new Set()), 2000);
      }
      prevEventCountRef.current = all.length;

      setFeedEvents(all);
      setLastFeedUpdate(Date.now());
      // Fetch prices in background
      fetchPrices(all);
    } catch {} setFeedLoading(false);
  }, [bundlers, notifySound, fetchPrices]);

  // Auto-load default bundlers on first visit
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
  useEffect(() => {
    if (autoRefresh && tab === "bundlers") {
      intervalRef.current = setInterval(fetchFeed, 15000); // 15s when live
      return () => clearInterval(intervalRef.current);
    } else if (intervalRef.current) clearInterval(intervalRef.current);
  }, [autoRefresh, tab, fetchFeed]);

  const loadDefaults = async () => {
    try {
      const r = await fetch("/bundlers-default.json"); const d = await r.json();
      const ex = new Set(bundlers.map(b => b.address));
      const nw = [...bundlers, ...d.filter((x: any) => !ex.has(x.address)).map((x: any) => ({ address: x.address, label: x.name, emoji: x.emoji, group: x.group, addedAt: Date.now(), seenIn: [] as string[] }))];
      setBundlers(nw); localStorage.setItem("holdtech-bundlers", JSON.stringify(nw));
    } catch {}
  };

  // Inline scan from feed
  const handleInlineScan = async (mint: string) => {
    if (expandedFeedItem === mint) { setExpandedFeedItem(null); setInlineScanResult(null); return; }
    setExpandedFeedItem(mint); setInlineScanResult(null); setInlineScanning(true);
    const r = await runScan(mint);
    if (r) {
      setInlineScanResult(r);
      const nh = [r, ...historyRef.current.filter(h => h.mint !== r.mint)].slice(0, 50);
      setHistory(nh); localStorage.setItem("holdtech-history", JSON.stringify(nh));
    }
    setInlineScanning(false);
  };

  // Coordinated buy detection
  const coordinated = useMemo((): CoordinatedAlert[] => {
    const byToken: Record<string, FeedEvent[]> = {};
    const EXCLUDED_MINTS = new Set([
      "So11111111111111111111111111111111111111112", // SOL
      "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v", // USDC
      "Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB", // USDT
    ]);
    feedEvents.forEach(ev => {
      if (ev.type !== "buy") return;
      if (EXCLUDED_MINTS.has(ev.tokenMint)) return;
      if (!byToken[ev.tokenMint]) byToken[ev.tokenMint] = [];
      byToken[ev.tokenMint].push(ev);
    });
    const alerts: CoordinatedAlert[] = [];
    for (const [mint, events] of Object.entries(byToken)) {
      const uniqueWallets = new Set(events.map(e => e.wallet));
      if (uniqueWallets.size >= 3) {
        alerts.push({
          tokenMint: mint,
          tokenSymbol: events[0].tokenSymbol,
          tokenImage: events[0].tokenImage,
          wallets: events.map(e => ({ name: e.walletName, emoji: e.walletEmoji, type: e.type, solAmount: e.solAmount, timestamp: e.timestamp })),
          totalSol: events.reduce((s, e) => s + e.solAmount, 0),
          firstSeen: Math.min(...events.map(e => e.timestamp)),
        });
      }
    }
    return alerts.sort((a, b) => b.wallets.length - a.wallets.length);
  }, [feedEvents]);

  // Feed groups + filters
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

  // Overview stats
  const avgScore = history.length > 0 ? Math.round(history.reduce((s, h) => s + h.score, 0) / history.length) : 0;
  const bestScan = history.length > 0 ? history.reduce((b, h) => h.score > b.score ? h : b, history[0]) : null;
  const worstScan = history.length > 0 ? history.reduce((w, h) => h.score < w.score ? h : w, history[0]) : null;
  const recentScans = history.slice(0, 5);
  const gradeDistribution = { A: 0, B: 0, C: 0, D: 0, F: 0 };
  history.forEach(h => { const k = h.grade?.[0] as keyof typeof gradeDistribution; if (k in gradeDistribution) gradeDistribution[k]++; });

  const M: React.CSSProperties = { fontFamily: "'JetBrains Mono', 'Fira Code', 'Courier New', monospace" };

  const tabs = [
    { id: "bundlers" as const, label: "Bundler Feed", icon: "⬡", count: bundlers.length, alert: coordinated.length > 0 },
    { id: "scan" as const, label: "Scan", icon: "⊕" },
    { id: "overview" as const, label: "Overview", icon: "◫" },
    { id: "watchlist" as const, label: "Watchlist", icon: "◉", count: watchlist.length },
    { id: "history" as const, label: "History", icon: "◷", count: history.length },
    { id: "batch" as const, label: "Batch", icon: "▤" },
  ];

  const cardBg = darkMode ? "rgba(22,22,42,0.7)" : "rgba(255,255,255,0.6)";
  const cardBgSolid = darkMode ? "rgba(18,18,36,0.9)" : "rgba(255,255,255,0.8)";
  const subtleBg = darkMode ? "rgba(255,255,255,0.04)" : "rgba(0,0,0,0.03)";
  const metricBg = darkMode ? "rgba(153,69,255,0.08)" : "rgba(153,69,255,0.03)";
  const card = (extra?: React.CSSProperties): React.CSSProperties => ({
    background: cardBg,
    backdropFilter: "blur(16px)", WebkitBackdropFilter: "blur(16px)",
    border: `1px solid var(--border, ${darkMode ? "rgba(153,69,255,0.12)" : "rgba(153,69,255,0.08)"})`,
    borderRadius: "14px", ...extra,
  });

  const pill = (active: boolean, color?: string): React.CSSProperties => ({
    ...M, padding: "5px 12px", borderRadius: "20px", border: "none", cursor: "pointer",
    fontSize: "10px", fontWeight: 700, letterSpacing: "0.03em",
    background: active ? `${color || "#9945FF"}15` : subtleBg,
    color: active ? (color || "#9945FF") : "var(--text-muted, #888)", transition: "all 0.2s",
  });

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

  return (
    <div style={{ minHeight: "100vh", background: "var(--bg, #f0f0f6)", fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif", color: "var(--text, #1a1a2e)" }}>
      {/* Grid bg */}
      <div className="grid-bg" />

      {/* Mobile header */}
      <div className="mobile-header">
        <button onClick={() => setMobileNav(!mobileNav)} style={{ background: "none", border: "none", fontSize: "20px", cursor: "pointer", padding: "4px" }}>☰</button>
        <a href="/" style={{ display: "flex", alignItems: "center", gap: "6px", textDecoration: "none" }}>
          <img src="/logo.png" alt="" width={22} height={22} />
          <span style={{ fontSize: "15px", fontWeight: 800 }}><span style={{ color: "#9945FF" }}>HOLD</span><span style={{ color: "#888" }}>TECH</span></span>
        </a>
        <div style={{ display: "flex", gap: "6px" }}>
          <button onClick={toggleTheme} style={{ background: "none", border: "none", fontSize: "16px", cursor: "pointer" }}>{darkMode ? "☀️" : "🌙"}</button>
        </div>
      </div>

      <div style={{ position: "relative", zIndex: 1, display: "flex", minHeight: "100vh" }}>
        {/* ═══ SIDEBAR ═══ */}
        <div className={`sidebar ${mobileNav ? "sidebar-open" : ""}`}>
          <a href="/" className="sidebar-logo">
            <img src="/logo.png" alt="" width={28} height={28} style={{ objectFit: "contain" }} />
            <span style={{ fontSize: "17px", fontWeight: 800, letterSpacing: "-0.02em" }}><span style={{ color: "var(--accent, #9945FF)" }}>HOLD</span><span style={{ color: "var(--text-muted, #888)" }}>TECH</span></span>
            <span style={{ ...M, fontSize: "8px", fontWeight: 700, color: "#9945FF", background: "rgba(153,69,255,0.08)", padding: "2px 5px", borderRadius: "4px" }}>BETA</span>
          </a>

          {tabs.map((t, i) => (
            <div key={t.id}>
              {i === 2 && <div style={{ height: "1px", background: "var(--border, rgba(153,69,255,0.06))", margin: "8px 12px" }} />}
              <button onClick={() => { setTab(t.id); setMobileNav(false); }} style={{
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
                {(t as any).alert && <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#ef4444", animation: "pulse 1.5s infinite" }} />}
                {t.count !== undefined && t.count > 0 && (
                  <span style={{ fontSize: "9px", fontWeight: 700, background: tab === t.id ? "rgba(153,69,255,0.15)" : "rgba(0,0,0,0.04)", padding: "2px 7px", borderRadius: "10px" }}>{t.count}</span>
                )}
              </button>
            </div>
          ))}

          <div style={{ flex: 1 }} />

          <div style={{ ...card({ padding: "14px", marginTop: "8px" }) }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "8px" }}>
              <div style={{ ...M, fontSize: "9px", fontWeight: 700, color: tier.color, letterSpacing: "0.1em", textTransform: "uppercase" }}>{tier.icon} {tier.name}</div>
              {isDemo && <span style={{ ...M, fontSize: "8px", color: "#14F195", background: "rgba(20,241,149,0.1)", padding: "2px 6px", borderRadius: "4px" }}>DEMO</span>}
            </div>
            {connected && publicKey ? (
              <div style={{ ...M, fontSize: "10px", color: "var(--text-muted, #888)" }}>{publicKey.toBase58().slice(0, 4)}...{publicKey.toBase58().slice(-4)}</div>
            ) : <div style={{ ...M, fontSize: "10px", color: "var(--text-muted, #aaa)" }}>No wallet</div>}
          </div>

          <div style={{ display: "flex", gap: "4px", marginTop: "6px" }}>
            <button onClick={toggleTheme} style={{ flex: 1, padding: "9px", borderRadius: "10px", border: "1px solid var(--border, rgba(153,69,255,0.06))", background: subtleBg, cursor: "pointer", fontSize: "13px" }}>{darkMode ? "☀️" : "🌙"}</button>
            <a href="/docs" style={{ flex: 1, padding: "9px", borderRadius: "10px", border: "1px solid var(--border, rgba(153,69,255,0.06))", background: subtleBg, textDecoration: "none", textAlign: "center", fontSize: "10px", fontWeight: 700, color: "var(--text-muted, #888)", display: "flex", alignItems: "center", justifyContent: "center", ...M }}>DOCS</a>
            <a href="/" style={{ flex: 1, padding: "9px", borderRadius: "10px", border: "1px solid var(--border, rgba(153,69,255,0.06))", background: subtleBg, textDecoration: "none", textAlign: "center", fontSize: "10px", fontWeight: 700, color: "var(--text-muted, #888)", display: "flex", alignItems: "center", justifyContent: "center", ...M }}>HOME</a>
          </div>
        </div>

        {/* Mobile overlay */}
        {mobileNav && <div className="mobile-overlay" onClick={() => setMobileNav(false)} />}

        {/* ═══ MAIN ═══ */}
        <div className="main-content">

          {/* ═══ BUNDLER FEED ═══ */}
          {tab === "bundlers" && (
            <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
              {/* Header */}
              <div className="feed-header">
                <div>
                  <div style={{ ...M, fontSize: "20px", fontWeight: 800, letterSpacing: "-0.02em" }}>Bundler Feed</div>
                  <div style={{ ...M, fontSize: "11px", color: "var(--text-muted, #888)", marginTop: "2px" }}>
                    {bundlers.length} wallets tracked
                    {lastFeedUpdate && <> · updated {timeAgo(lastFeedUpdate)}</>}
                    {autoRefresh && <span style={{ color: "#14F195" }}> · <span className="live-dot">●</span> LIVE</span>}
                  </div>
                </div>
                <div className="feed-controls">
                  <button onClick={() => { const n = !notifySound; setNotifySound(n); localStorage.setItem("holdtech-notify", n.toString()); }} style={{
                    ...M, padding: "7px 12px", borderRadius: "8px", border: "none", cursor: "pointer",
                    fontSize: "12px", background: notifySound ? "rgba(153,69,255,0.08)" : "rgba(0,0,0,0.03)",
                    color: notifySound ? "#9945FF" : "var(--text-muted, #aaa)",
                  }} title="Toggle notification sound">{notifySound ? "🔔" : "🔕"}</button>
                  <button onClick={() => setAutoRefresh(!autoRefresh)} style={{
                    ...M, padding: "7px 14px", borderRadius: "8px", border: "none", cursor: "pointer",
                    fontSize: "10px", fontWeight: 700, transition: "all 0.2s",
                    background: autoRefresh ? "rgba(20,241,149,0.12)" : "rgba(0,0,0,0.03)",
                    color: autoRefresh ? "#14F195" : "var(--text-muted, #888)",
                    boxShadow: autoRefresh ? "0 0 12px rgba(20,241,149,0.15)" : "none",
                  }}>{autoRefresh ? "● LIVE" : "○ AUTO"}</button>
                  <button onClick={fetchFeed} disabled={feedLoading} style={{
                    ...M, padding: "7px 14px", background: "linear-gradient(135deg, #9945FF, #7B3FE4)",
                    color: "white", border: "none", borderRadius: "8px", fontSize: "10px", fontWeight: 700,
                    cursor: "pointer", opacity: feedLoading ? 0.6 : 1,
                  }}>{feedLoading ? "Loading..." : "↻ Refresh"}</button>
                  <button onClick={() => setShowManage(!showManage)} style={{
                    ...M, padding: "7px 14px", background: showManage ? "rgba(153,69,255,0.08)" : "rgba(0,0,0,0.03)",
                    color: showManage ? "#9945FF" : "var(--text-muted, #888)",
                    border: "none", borderRadius: "8px", fontSize: "10px", fontWeight: 700, cursor: "pointer",
                  }}>{showManage ? "✕ Close" : "⚙ Manage"}</button>
                </div>
              </div>

              {/* ═══ COORDINATED ALERTS ═══ */}
              {coordinated.length > 0 && (
                <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                  {coordinated.map(alert => {
                    const price = tokenPrices[alert.tokenMint];
                    return (
                      <div key={alert.tokenMint} className="coordinated-alert" style={{
                        ...card({ padding: "18px", borderColor: "rgba(239,68,68,0.25)", borderLeft: "4px solid #ef4444" }),
                        background: "linear-gradient(135deg, rgba(239,68,68,0.04), rgba(239,68,68,0.01))",
                      }}>
                        <div style={{ display: "flex", alignItems: "center", gap: "4px", marginBottom: "10px" }}>
                          <span style={{ ...M, fontSize: "9px", fontWeight: 800, color: "#ef4444", letterSpacing: "0.1em", background: "rgba(239,68,68,0.1)", padding: "3px 8px", borderRadius: "4px", animation: "pulse 2s infinite" }}>⚠ COORDINATED BUY</span>
                          <span style={{ ...M, fontSize: "9px", color: "var(--text-muted, #888)" }}>{alert.wallets.length} bundler wallets</span>
                        </div>
                        <div style={{ display: "flex", alignItems: "center", gap: "14px" }}>
                          <div style={{ width: 48, height: 48, borderRadius: "12px", overflow: "hidden", flexShrink: 0, background: "rgba(239,68,68,0.06)", display: "flex", alignItems: "center", justifyContent: "center", border: "2px solid rgba(239,68,68,0.15)" }}>
                            {alert.tokenImage ? <img src={alert.tokenImage} alt="" width={48} height={48} style={{ objectFit: "cover" }} onError={e => { (e.target as HTMLImageElement).style.display = "none"; }} /> : <span style={{ fontSize: "22px" }}>🪙</span>}
                          </div>
                          <div style={{ flex: 1 }}>
                            <div style={{ display: "flex", alignItems: "baseline", gap: "8px" }}>
                              <span style={{ fontSize: "18px", fontWeight: 800 }}>${alert.tokenSymbol}</span>
                              <span style={{ ...M, fontSize: "13px", fontWeight: 700, color: "#ef4444" }}>{alert.totalSol.toFixed(2)} SOL total</span>
                            </div>
                            <div style={{ ...M, fontSize: "9px", color: "var(--text-muted, #888)", marginTop: "2px" }}>
                              {alert.tokenMint.slice(0, 12)}...{alert.tokenMint.slice(-6)}
                            </div>
                            {price && (
                              <div style={{ display: "flex", gap: "8px", marginTop: "6px", flexWrap: "wrap" }}>
                                {price.mc && <span style={{ ...M, fontSize: "10px", color: "var(--text-muted, #888)" }}>MC: {fmtMc(price.mc)}</span>}
                                {price.change5m !== null && <span style={{ ...M, fontSize: "10px", color: chgColor(price.change5m) }}>5m: {price.change5m > 0 ? "+" : ""}{price.change5m.toFixed(1)}%</span>}
                                {price.change1h !== null && <span style={{ ...M, fontSize: "10px", color: chgColor(price.change1h) }}>1h: {price.change1h > 0 ? "+" : ""}{price.change1h.toFixed(1)}%</span>}
                              </div>
                            )}
                          </div>
                          <div style={{ display: "flex", flexDirection: "column", gap: "4px", alignItems: "flex-end" }}>
                            <button onClick={() => handleInlineScan(alert.tokenMint)} style={{
                              ...M, padding: "6px 14px", background: "rgba(239,68,68,0.08)", color: "#ef4444",
                              border: "none", borderRadius: "8px", fontSize: "10px", fontWeight: 700, cursor: "pointer",
                            }}>🔍 SCAN</button>
                            <a href={`https://dexscreener.com/solana/${alert.tokenMint}`} target="_blank" rel="noopener" style={{ ...M, fontSize: "9px", color: "#9945FF", textDecoration: "none" }}>DexScreener ↗</a>
                          </div>
                        </div>
                        <div style={{ display: "flex", gap: "6px", marginTop: "10px", flexWrap: "wrap" }}>
                          {alert.wallets.map((w, wi) => (
                            <span key={wi} style={{ ...M, fontSize: "9px", color: "var(--text-muted, #666)", background: "rgba(239,68,68,0.05)", padding: "3px 8px", borderRadius: "6px", border: "1px solid rgba(239,68,68,0.1)" }}>
                              {w.emoji} {w.name} · {w.solAmount.toFixed(2)} SOL
                            </span>
                          ))}
                        </div>
                        {/* Inline scan result */}
                        {expandedFeedItem === alert.tokenMint && (
                          <div style={{ marginTop: "12px", paddingTop: "12px", borderTop: "1px solid rgba(239,68,68,0.1)" }}>
                            {inlineScanning && <div style={{ textAlign: "center", padding: "16px" }}><div className="spinner" style={{ borderTopColor: "#ef4444" }} /><div style={{ ...M, fontSize: "10px", color: "var(--text-muted, #888)", marginTop: "8px" }}>Scanning holder quality...</div></div>}
                            {inlineScanResult && inlineScanResult.mint === alert.tokenMint && (
                              <div style={{ display: "grid", gridTemplateColumns: "auto repeat(5, 1fr)", gap: "10px", alignItems: "center" }}>
                                <div style={{ ...M, fontSize: "36px", fontWeight: 800, color: gc(inlineScanResult.grade), background: `${gc(inlineScanResult.grade)}12`, padding: "4px 16px", borderRadius: "12px", textAlign: "center" }}>{inlineScanResult.grade}</div>
                                {[{ l: "Score", v: `${inlineScanResult.score}/100` }, { l: "Holders", v: inlineScanResult.holders.toLocaleString() }, { l: "Top 5", v: `${inlineScanResult.top5Pct}%` }, { l: "Fresh", v: `${inlineScanResult.freshPct}%` }, { l: "Avg Age", v: `${inlineScanResult.avgAge}d` }].map(m => (
                                  <div key={m.l} style={{ background: "rgba(239,68,68,0.03)", borderRadius: "10px", padding: "10px" }}>
                                    <div style={{ ...M, fontSize: "7px", fontWeight: 700, color: "var(--text-muted, #888)", letterSpacing: "0.1em", textTransform: "uppercase" }}>{m.l}</div>
                                    <div style={{ ...M, fontSize: "16px", fontWeight: 800, marginTop: "2px" }}>{m.v}</div>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Stats row */}
              {feedEvents.length > 0 && (
                <div className="stats-grid">
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
                  <div style={{ display: "flex", gap: "6px", marginBottom: "12px", flexWrap: "wrap" }}>
                    <input value={bundlerInput} onChange={e => setBundlerInput(e.target.value)} placeholder="Wallet address..." className="manage-input" style={{ flex: 2, minWidth: "200px" }} spellCheck={false} />
                    <input value={bundlerLabel} onChange={e => setBundlerLabel(e.target.value)} placeholder="Label" className="manage-input" style={{ flex: 1, minWidth: "100px" }} />
                    <button onClick={() => { const a = bundlerInput.trim(); if (!a || a.length < 32 || bundlers.find(b => b.address === a)) return; const n = [...bundlers, { address: a, label: bundlerLabel.trim() || a.slice(0, 8), emoji: "🚩", group: "custom", addedAt: Date.now(), seenIn: [] as string[] }]; setBundlers(n); localStorage.setItem("holdtech-bundlers", JSON.stringify(n)); setBundlerInput(""); setBundlerLabel(""); }} className="btn-primary" style={{ ...M }}>ADD</button>
                  </div>
                  <div style={{ display: "flex", gap: "6px", marginBottom: "12px", flexWrap: "wrap" }}>
                    <button onClick={loadDefaults} style={pill(false)}>Load Defaults (merge)</button>
                    <button onClick={() => navigator.clipboard.writeText(JSON.stringify(bundlers.map(b => ({ address: b.address, label: b.label, emoji: b.emoji, group: b.group })), null, 2))} style={pill(false)}>Export JSON</button>
                  </div>
                  <textarea id="imp-json" placeholder='Paste JSON array or one address per line...' className="manage-textarea" spellCheck={false} />
                  <button onClick={() => { const el = document.getElementById("imp-json") as HTMLTextAreaElement; if (!el?.value.trim()) return; const ex = new Set(bundlers.map(b => b.address)); let nw: any[] = []; try { const p = JSON.parse(el.value); if (Array.isArray(p)) nw = p.filter((d: any) => !ex.has(d.trackedWalletAddress || d.address)).map((d: any) => ({ address: d.trackedWalletAddress || d.address, label: d.name || d.label || "—", emoji: d.emoji || "🚩", group: d.groups?.[0] || d.groupNames?.[0] || d.group || "imported", addedAt: Date.now(), seenIn: [] as string[] })); } catch { nw = el.value.split(/[\n,]+/).map(s => s.trim()).filter(s => s.length >= 32 && !ex.has(s)).map(a => ({ address: a, label: a.slice(0, 8), emoji: "🚩", group: "imported", addedAt: Date.now(), seenIn: [] as string[] })); } if (nw.length) { const nb = [...bundlers, ...nw]; setBundlers(nb); localStorage.setItem("holdtech-bundlers", JSON.stringify(nb)); el.value = ""; } }} className="btn-primary" style={{ ...M, marginTop: "8px" }}>IMPORT</button>
                  <div style={{ maxHeight: "200px", overflow: "auto", marginTop: "14px", borderTop: "1px solid var(--border, rgba(0,0,0,0.04))", paddingTop: "8px" }}>
                    {bundlers.map(b => (
                      <div key={b.address} className="wallet-row">
                        <div style={{ display: "flex", alignItems: "center", gap: "6px", minWidth: 0 }}>
                          <span style={{ fontSize: "13px" }}>{b.emoji}</span>
                          <span style={{ fontWeight: 600, whiteSpace: "nowrap" }}>{b.label}</span>
                          <span style={{ ...M, fontSize: "9px", color: "var(--text-muted, #aaa)" }}>{b.address.slice(0, 6)}..{b.address.slice(-4)}</span>
                          {b.group && <span style={{ ...M, fontSize: "8px", color: "#9945FF", background: darkMode ? "rgba(153,69,255,0.12)" : "rgba(153,69,255,0.06)", padding: "1px 5px", borderRadius: "4px" }}>{b.group}</span>}
                        </div>
                        <button onClick={() => { const n = bundlers.filter(x => x.address !== b.address); setBundlers(n); localStorage.setItem("holdtech-bundlers", JSON.stringify(n)); }} style={{ background: "none", border: "none", cursor: "pointer", color: "#ccc", fontSize: "14px", padding: "2px 6px" }}>×</button>
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
                  <div style={{ fontSize: "12px", color: "var(--text-muted, #888)", marginBottom: "20px" }}>Load the default rugger list or add your own wallets</div>
                  <button onClick={loadDefaults} className="btn-primary" style={{ ...M, padding: "12px 28px", fontSize: "12px", boxShadow: "0 4px 16px rgba(153,69,255,0.2)" }}>Load Default Ruggers (49)</button>
                </div>
              )}

              {/* Skeleton loading */}
              {feedLoading && feedEvents.length === 0 && (
                <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                  {Array.from({ length: 6 }).map((_, i) => (
                    <div key={i} className="skeleton-row" style={{ opacity: 1 - i * 0.12 }}>
                      <div style={{ width: 42, height: 42, borderRadius: "10px", background: darkMode ? "rgba(153,69,255,0.12)" : "rgba(153,69,255,0.06)" }} />
                      <div style={{ width: 40, height: 18, borderRadius: "4px", background: "rgba(153,69,255,0.04)" }} />
                      <div style={{ flex: 1 }}>
                        <div style={{ width: "40%", height: 14, borderRadius: "4px", background: darkMode ? "rgba(153,69,255,0.12)" : "rgba(153,69,255,0.06)", marginBottom: "6px" }} />
                        <div style={{ width: "60%", height: 10, borderRadius: "3px", background: metricBg }} />
                      </div>
                      <div style={{ width: 80, height: 14, borderRadius: "4px", background: "rgba(153,69,255,0.04)" }} />
                    </div>
                  ))}
                </div>
              )}

              {/* Count */}
              {filteredFeed.length > 0 && !feedLoading && (
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <div style={{ ...M, fontSize: "10px", color: "var(--text-muted, #888)" }}>
                    Showing {Math.min(feedLimit, filteredFeed.length)} of {filteredFeed.length} transactions
                  </div>
                </div>
              )}

              {/* Feed items */}
              {filteredFeed.slice(0, feedLimit).map((ev, i) => {
                const price = tokenPrices[ev.tokenMint];
                const isNew = newEventIds.has(ev.signature);
                const isExpanded = expandedFeedItem === ev.tokenMint;
                return (
                  <div key={`${ev.signature}-${i}`}>
                    <div className={`feed-item ${isNew ? "feed-item-new" : ""}`} style={{
                      ...card({ padding: "12px 16px", display: "flex", alignItems: "center", gap: "12px", cursor: "pointer" }),
                      borderLeft: `3px solid ${ev.type === "buy" ? "rgba(20,241,149,0.4)" : "rgba(239,68,68,0.3)"}`,
                    }} onClick={() => handleInlineScan(ev.tokenMint)}>
                      {/* Token image */}
                      <div style={{ width: 42, height: 42, borderRadius: "10px", overflow: "hidden", flexShrink: 0, background: metricBg, display: "flex", alignItems: "center", justifyContent: "center", border: "1px solid rgba(153,69,255,0.06)" }}>
                        {ev.tokenImage ? <img src={ev.tokenImage} alt="" width={42} height={42} style={{ objectFit: "cover" }} onError={e => { (e.target as HTMLImageElement).style.display = "none"; }} /> : <span style={{ fontSize: "18px", opacity: 0.2 }}>🪙</span>}
                      </div>

                      <div style={{
                        ...M, fontSize: "9px", fontWeight: 800, padding: "4px 10px", borderRadius: "6px",
                        color: ev.type === "buy" ? "#14F195" : "#ef4444",
                        background: ev.type === "buy" ? "rgba(20,241,149,0.1)" : "rgba(239,68,68,0.08)",
                        minWidth: "36px", textAlign: "center",
                      }}>{ev.type === "buy" ? "BUY" : "SELL"}</div>

                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: "flex", alignItems: "baseline", gap: "8px", flexWrap: "wrap" }}>
                          <span style={{ fontSize: "14px", fontWeight: 700 }}>${ev.tokenSymbol}</span>
                          {ev.solAmount > 0 && <span style={{ ...M, fontSize: "13px", fontWeight: 800, color: ev.type === "buy" ? "#14F195" : "#ef4444" }}>{ev.solAmount.toFixed(2)} SOL</span>}
                          {/* Price data */}
                          {price && price.mc && <span style={{ ...M, fontSize: "10px", color: "var(--text-muted, #888)" }}>{fmtMc(price.mc)}</span>}
                          {price && price.change1h !== null && (
                            <span style={{ ...M, fontSize: "10px", fontWeight: 700, color: chgColor(price.change1h) }}>
                              {price.change1h > 0 ? "↑" : "↓"}{Math.abs(price.change1h).toFixed(0)}% 1h
                            </span>
                          )}
                        </div>
                        <div style={{ ...M, fontSize: "9px", color: "var(--text-muted, #aaa)", marginTop: "2px" }}>
                          {ev.tokenMint.slice(0, 8)}..{ev.tokenMint.slice(-4)}
                        </div>
                      </div>

                      <div style={{ textAlign: "right", flexShrink: 0 }}>
                        <div style={{ fontSize: "11px", fontWeight: 600, display: "flex", alignItems: "center", gap: "4px", justifyContent: "flex-end" }}>
                          <span style={{ fontSize: "13px" }}>{ev.walletEmoji}</span><span>{ev.walletName}</span>
                        </div>
                        <div style={{ ...M, fontSize: "9px", color: "var(--text-muted, #aaa)", marginTop: "2px" }}>
                          {new Date(ev.timestamp).toLocaleString(undefined, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
                        </div>
                      </div>

                      <div className="feed-item-links" onClick={e => e.stopPropagation()}>
                        <a href={`https://solscan.io/tx/${ev.signature}`} target="_blank" rel="noopener" style={{ ...M, color: "#9945FF", textDecoration: "none", fontSize: "10px", opacity: 0.6 }}>TX ↗</a>
                        <a href={`https://dexscreener.com/solana/${ev.tokenMint}`} target="_blank" rel="noopener" style={{ ...M, color: "#9945FF", textDecoration: "none", fontSize: "10px", opacity: 0.6 }}>DS ↗</a>
                      </div>
                    </div>

                    {/* Inline scan result */}
                    {isExpanded && (
                      <div style={{ ...card({ padding: "16px", marginTop: "-1px", borderTop: "none", borderTopLeftRadius: 0, borderTopRightRadius: 0, borderLeft: `3px solid rgba(153,69,255,0.3)` }) }}>
                        {inlineScanning && <div style={{ textAlign: "center", padding: "16px" }}><div className="spinner" /><div style={{ ...M, fontSize: "10px", color: "var(--text-muted, #888)", marginTop: "8px" }}>Scanning holder quality...</div></div>}
                        {inlineScanResult && inlineScanResult.mint === ev.tokenMint && (
                          <div className="inline-scan-grid">
                            <div style={{ ...M, fontSize: "36px", fontWeight: 800, color: gc(inlineScanResult.grade), background: `${gc(inlineScanResult.grade)}12`, padding: "8px 20px", borderRadius: "12px", textAlign: "center", gridRow: "1 / 3" }}>{inlineScanResult.grade}</div>
                            {[{ l: "Score", v: `${inlineScanResult.score}/100` }, { l: "Holders", v: inlineScanResult.holders.toLocaleString() }, { l: "Top 5%", v: `${inlineScanResult.top5Pct}%` }, { l: "Fresh Wallets", v: `${inlineScanResult.freshPct}%` }, { l: "Avg Age", v: `${inlineScanResult.avgAge}d` }].map(m => (
                              <div key={m.l} style={{ background: metricBg, borderRadius: "10px", padding: "10px 12px" }}>
                                <div style={{ ...M, fontSize: "7px", fontWeight: 700, color: "var(--text-muted, #888)", letterSpacing: "0.1em", textTransform: "uppercase" }}>{m.l}</div>
                                <div style={{ ...M, fontSize: "16px", fontWeight: 800, marginTop: "2px" }}>{m.v}</div>
                              </div>
                            ))}
                            <div style={{ gridColumn: "1 / -1", display: "flex", gap: "6px", marginTop: "4px" }}>
                              <button onClick={(e) => { e.stopPropagation(); addWatch(inlineScanResult); }} style={pill(false)}>+ Watchlist</button>
                              <a href={`/?mint=${inlineScanResult.mint}`} target="_blank" style={{ ...pill(false), textDecoration: "none", display: "inline-block" }}>Full Report →</a>
                            </div>
                          </div>
                        )}
                        {!inlineScanning && !inlineScanResult && <div style={{ ...M, fontSize: "11px", color: "#ef4444", textAlign: "center", padding: "12px" }}>Scan failed — try again</div>}
                      </div>
                    )}
                  </div>
                );
              })}

              {filteredFeed.length > feedLimit && (
                <button onClick={() => setFeedLimit(p => p + 50)} style={{
                  ...M, padding: "10px", background: "transparent", color: "var(--accent, #9945FF)",
                  border: "1px solid rgba(153,69,255,0.15)", borderRadius: "10px", fontSize: "11px",
                  fontWeight: 600, cursor: "pointer", width: "100%",
                }}>Load More ({filteredFeed.length - feedLimit} remaining)</button>
              )}

              {feedEvents.length > 0 && filteredFeed.length === 0 && (
                <div style={{ ...card({ padding: "40px", textAlign: "center" }) }}>
                  <div style={{ ...M, fontSize: "12px", color: "var(--text-muted, #888)" }}>No transactions for &quot;{feedFilter}&quot; group</div>
                </div>
              )}
            </div>
          )}

          {/* ═══ SCAN ═══ */}
          {tab === "scan" && (
            <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
              <div style={{ ...M, fontSize: "20px", fontWeight: 800, letterSpacing: "-0.02em" }}>Scan Token</div>
              <div style={{ ...M, fontSize: "12px", color: "var(--text-muted, #888)", marginBottom: "4px" }}>
                Full scan with verdict, deep analysis, bundle detection, funding traces, and charts.
              </div>
              <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
                <input value={scanInput} onChange={e => setScanInput(e.target.value)} onKeyDown={e => { if (e.key === "Enter") handleScan(); }} placeholder="Paste token mint address..." className="scan-input" spellCheck={false} />
                <button onClick={handleScan} disabled={!scanInput.trim() || scanning} className="btn-primary" style={{ ...M, padding: "13px 28px", fontSize: "12px", opacity: (!scanInput.trim() || scanning) ? 0.5 : 1 }}>{scanning ? `${progress || "Scanning..."}` : "SCAN →"}</button>
              </div>

              {/* Recent scans for quick re-access */}
              {/* ── Scan Result ── */}
              {scanResult && (
                <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                  {/* Header */}
                  <div style={{ ...card({ padding: "20px" }), borderLeft: `3px solid ${gc(scanResult.grade)}` }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "14px" }}>
                      <div style={{ textAlign: "center" }}>
                        <div style={{ width: 56, height: 56, borderRadius: "50%", background: gc(scanResult.grade), display: "flex", alignItems: "center", justifyContent: "center" }}>
                          <span style={{ ...M, fontSize: "22px", fontWeight: 900, color: "#000" }}>{scanResult.score}</span>
                        </div>
                        <div style={{ ...M, fontSize: "20px", fontWeight: 900, color: gc(scanResult.grade), marginTop: "2px" }}>{scanResult.grade}</div>
                      </div>
                      {scanResult.tokenImage && (
                        <img src={scanResult.tokenImage} alt={scanResult.symbol} style={{ width: 44, height: 44, borderRadius: "50%", objectFit: "cover", flexShrink: 0 }} />
                      )}
                      <div style={{ flex: 1 }}>
                        <div style={{ ...M, fontSize: "16px", fontWeight: 800 }}>{scanResult.symbol}</div>
                        <div style={{ ...M, fontSize: "10px", color: "var(--text-muted, #aaa)", fontFamily: "var(--mono)" }}>{scanResult.mint}</div>
                        <div style={{ ...M, fontSize: "11px", color: "var(--text-muted, #888)", marginTop: "4px" }}>{scanResult.holders.toLocaleString()} holders · scanned {timeAgo(scanResult.timestamp)}</div>
                      </div>
                      <div style={{ display: "flex", gap: "6px" }}>
                        <button onClick={() => addWatch(scanResult)} style={{ ...M, padding: "6px 12px", background: "rgba(153,69,255,0.08)", color: "#9945FF", border: "none", borderRadius: "6px", fontSize: "10px", fontWeight: 700, cursor: "pointer" }}>+ Watch</button>
                        <button onClick={() => window.open(`/?mint=${scanResult.mint}`, "_blank")} style={{ ...M, padding: "6px 12px", background: "rgba(20,241,149,0.08)", color: "#14F195", border: "none", borderRadius: "6px", fontSize: "10px", fontWeight: 700, cursor: "pointer" }}>Full Page →</button>
                      </div>
                    </div>
                    {scanResult.verdict && (
                      <div style={{ marginTop: "14px", padding: "12px", background: darkMode ? "rgba(255,255,255,0.02)" : "rgba(0,0,0,0.02)", borderRadius: "8px", fontSize: "12px", lineHeight: 1.6, color: "var(--text-secondary, #666)" }}>
                        {scanResult.verdict.verdict}
                      </div>
                    )}
                    {scanResult.verdict?.flags && scanResult.verdict.flags.length > 0 && (
                      <div style={{ marginTop: "8px", display: "flex", flexDirection: "column", gap: "4px" }}>
                        {scanResult.verdict.flags.map((f, i) => (
                          <div key={i} style={{ fontSize: "11px", color: "var(--text-secondary, #777)", padding: "5px 8px", borderRadius: "6px", background: darkMode ? "rgba(255,255,255,0.03)" : "rgba(153,69,255,0.03)" }}>{f}</div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Metrics Grid */}
                  {scanResult.metrics && (
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "8px" }}>
                      {[
                        { label: "Fresh Wallets", value: `${scanResult.metrics.freshWalletPct}%`, sub: `${scanResult.metrics.veryFreshWalletPct}% <24h`, warn: scanResult.metrics.freshWalletPct > 40 },
                        { label: "Veterans (90d+)", value: `${scanResult.metrics.veteranHolderPct}%`, sub: `${scanResult.metrics.ogHolderPct}% OG (180d+)` },
                        { label: "Low Activity", value: `${scanResult.metrics.lowActivityPct}%`, sub: "<10 txs", warn: scanResult.metrics.lowActivityPct > 40 },
                        { label: "Single Token", value: `${scanResult.metrics.singleTokenPct}%`, sub: "only hold this", warn: scanResult.metrics.singleTokenPct > 30 },
                        { label: "Avg Wallet Age", value: `${scanResult.metrics.avgWalletAgeDays}d`, sub: `median: ${scanResult.metrics.medianWalletAgeDays}d` },
                        { label: "Avg Tx Count", value: `${scanResult.metrics.avgTxCount}`, sub: "lifetime txs" },
                        { label: "Avg SOL Balance", value: `${scanResult.metrics.avgSolBalance}`, sub: "SOL/wallet", warn: scanResult.metrics.avgSolBalance < 0.5 },
                        { label: "Diamond Hands", value: `${scanResult.metrics.diamondHandsPct}%`, sub: "holding 2d+" },
                      ].map(m => (
                        <div key={m.label} style={{ ...card({ padding: "10px" }), borderColor: m.warn ? "rgba(239,68,68,0.25)" : undefined }}>
                          <div style={{ ...M, fontSize: "8px", fontWeight: 700, color: "var(--text-muted, #999)", textTransform: "uppercase", letterSpacing: "0.08em" }}>{m.label}</div>
                          <div style={{ ...M, fontSize: "18px", fontWeight: 800, marginTop: "2px", color: m.warn ? "#ef4444" : undefined }}>{m.value}</div>
                          {m.sub && <div style={{ fontSize: "9px", color: "var(--text-muted, #aaa)", marginTop: "1px" }}>{m.sub}</div>}
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Distribution Bars */}
                  {scanResult.distribution && (
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
                      {[
                        { title: "Wallet Age Distribution", data: scanResult.distribution.walletAge, color: "#9945FF" },
                        { title: "Hold Duration Distribution", data: scanResult.distribution.holdDuration, color: "#14F195" },
                      ].map(chart => (
                        <div key={chart.title} style={card({ padding: "14px" })}>
                          <div style={{ ...M, fontSize: "11px", fontWeight: 700, color: "var(--text-muted, #888)", marginBottom: "10px" }}>{chart.title}</div>
                          {chart.data.map((d: DistBucket) => {
                            const max = Math.max(...chart.data.map((x: DistBucket) => x.pct), 1);
                            return (
                              <div key={d.label} style={{ display: "flex", alignItems: "center", gap: "6px", marginBottom: "4px", fontSize: "10px" }}>
                                <span style={{ width: "70px", textAlign: "right", color: "var(--text-muted, #888)", flexShrink: 0, ...M }}>{d.label}</span>
                                <div style={{ flex: 1, height: "14px", borderRadius: "3px", background: darkMode ? "rgba(255,255,255,0.04)" : "rgba(153,69,255,0.04)", overflow: "hidden" }}>
                                  <div style={{ height: "100%", width: `${(d.pct / max) * 100}%`, background: chart.color, borderRadius: "3px", transition: "width 0.4s" }} />
                                </div>
                                <span style={{ width: "55px", flexShrink: 0, color: "var(--text-secondary, #666)", ...M }}>{d.pct}% ({d.count})</span>
                              </div>
                            );
                          })}
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Top Holders Table */}
                  {scanResult.topHolders && scanResult.topHolders.length > 0 && (
                    <div style={card({ padding: "0", overflow: "hidden" })}>
                      <div style={{ padding: "12px 16px", borderBottom: `1px solid ${darkMode ? "rgba(255,255,255,0.06)" : "rgba(153,69,255,0.08)"}`, ...M, fontSize: "11px", fontWeight: 700 }}>Top {scanResult.topHolders.length} Holders</div>
                      <div style={{ overflowX: "auto" }}>
                        <table style={{ width: "100%", fontSize: "10px", borderCollapse: "collapse" }}>
                          <thead>
                            <tr style={{ borderBottom: `1px solid ${darkMode ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.06)"}` }}>
                              {["#", "Wallet", "Balance %", "Age", "Txs", "Status"].map(h => (
                                <th key={h} style={{ ...M, padding: "8px 10px", textAlign: h === "#" || h === "Wallet" ? "left" : "right", fontSize: "8px", textTransform: "uppercase", letterSpacing: "0.1em", color: "var(--text-muted, #999)", fontWeight: 700 }}>{h}</th>
                              ))}
                            </tr>
                          </thead>
                          <tbody>
                            {scanResult.topHolders.map((h, i) => (
                              <tr key={h.address} style={{ borderBottom: `1px solid ${darkMode ? "rgba(255,255,255,0.03)" : "rgba(0,0,0,0.03)"}` }}>
                                <td style={{ ...M, padding: "7px 10px", color: "var(--text-muted, #999)" }}>{i + 1}</td>
                                <td style={{ ...M, padding: "7px 10px", fontFamily: "var(--mono, monospace)" }}>
                                  <a href={`https://solscan.io/account/${h.address}`} target="_blank" rel="noopener" style={{ color: "#9945FF", textDecoration: "none" }}>{h.address.slice(0, 4)}...{h.address.slice(-4)}</a>
                                </td>
                                <td style={{ ...M, padding: "7px 10px", textAlign: "right" }}>{h.balancePct}%</td>
                                <td style={{ ...M, padding: "7px 10px", textAlign: "right", color: h.walletAgeDays < 7 ? "#ef4444" : h.walletAgeDays > 90 ? "#14F195" : "var(--text-secondary, #666)" }}>
                                  {h.walletAgeDays < 1 ? "<1d" : `${Math.round(h.walletAgeDays)}d`}
                                </td>
                                <td style={{ ...M, padding: "7px 10px", textAlign: "right", color: h.totalTxCount < 10 ? "#ef4444" : "var(--text-secondary, #666)" }}>{h.totalTxCount.toLocaleString()}</td>
                                <td style={{ padding: "7px 10px", textAlign: "right" }}>
                                  {h.isPool ? (
                                    <span style={{ color: "#a78bfa", background: "rgba(167,139,250,0.1)", padding: "2px 5px", borderRadius: "3px", fontSize: "8px", fontWeight: 700 }}>POOL</span>
                                  ) : h.isFresh ? (
                                    <span style={{ color: "#ef4444", background: "rgba(239,68,68,0.1)", padding: "2px 5px", borderRadius: "3px", fontSize: "8px", fontWeight: 700 }}>FRESH</span>
                                  ) : h.walletAgeDays > 180 ? (
                                    <span style={{ color: "#14F195", background: "rgba(20,241,149,0.1)", padding: "2px 5px", borderRadius: "3px", fontSize: "8px", fontWeight: 700 }}>OG</span>
                                  ) : h.walletAgeDays > 90 ? (
                                    <span style={{ color: "#9945FF", background: "rgba(153,69,255,0.1)", padding: "2px 5px", borderRadius: "3px", fontSize: "8px", fontWeight: 700 }}>VET</span>
                                  ) : <span style={{ color: "var(--text-muted, #999)" }}>—</span>}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {history.length > 0 && (
                <div style={{ ...card({ padding: "20px" }) }}>
                  <div style={{ ...M, fontSize: "11px", fontWeight: 700, color: "var(--text-muted, #888)", marginBottom: "12px" }}>RECENT SCANS</div>
                  {history.slice(0, 10).map((h, i) => (
                    <div key={h.mint + i} style={{
                      display: "flex", alignItems: "center", gap: "12px", padding: "10px 0",
                      borderTop: i > 0 ? `1px solid var(--border, rgba(153,69,255,0.06))` : "none", cursor: "pointer",
                    }} onClick={() => window.open(`/?mint=${h.mint}`, "_blank")}>
                      <span style={{ ...M, fontSize: "18px", fontWeight: 800, color: gc(h.grade), minWidth: "32px" }}>{h.grade}</span>
                      {h.tokenImage && <img src={h.tokenImage} alt={h.symbol} style={{ width: 28, height: 28, borderRadius: "50%", objectFit: "cover", flexShrink: 0 }} />}
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: "13px", fontWeight: 700 }}>{h.symbol}</div>
                        <div style={{ ...M, fontSize: "9px", color: "var(--text-muted, #aaa)" }}>{h.mint.slice(0, 8)}...{h.mint.slice(-6)}</div>
                      </div>
                      <div style={{ textAlign: "right" }}>
                        <div style={{ ...M, fontSize: "12px", fontWeight: 700 }}>{h.score}/100</div>
                        <div style={{ ...M, fontSize: "9px", color: "var(--text-muted, #aaa)" }}>{h.holders.toLocaleString()} holders · {timeAgo(h.timestamp)}</div>
                      </div>
                      <span style={{ ...M, fontSize: "11px", color: "var(--accent, #9945FF)", opacity: 0.6 }}>→</span>
                    </div>
                  ))}
                </div>
              )}

              {history.length === 0 && (
                <div style={{ ...card({ padding: "48px", textAlign: "center" }) }}>
                  <div style={{ fontSize: "36px", marginBottom: "10px", opacity: 0.3 }}>⊕</div>
                  <div style={{ fontSize: "14px", fontWeight: 600, marginBottom: "4px" }}>No scans yet</div>
                  <div style={{ fontSize: "12px", color: "var(--text-muted, #888)" }}>Paste a token address above for a full holderbase analysis</div>
                </div>
              )}
            </div>
          )}

          {/* ═══ OVERVIEW ═══ */}
          {tab === "overview" && (
            <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
              <div style={{ ...M, fontSize: "20px", fontWeight: 800, letterSpacing: "-0.02em" }}>Dashboard</div>
              <div className="stats-grid">
                {[
                  { label: "Total Scans", value: history.length.toString(), sub: "all time" },
                  { label: "Avg Score", value: avgScore ? `${avgScore}/100` : "—", sub: history.length > 0 ? `${history.length} scans` : "no data" },
                  { label: "Watching", value: watchlist.length.toString(), sub: `of ${tier.name === "FREE" ? 3 : tier.name === "SCOUT" ? 10 : tier.name === "OPERATOR" ? 50 : 200}` },
                  { label: "Bundlers", value: bundlers.length.toString(), sub: "tracked" },
                ].map(s => (
                  <div key={s.label} style={{ ...card({ padding: "16px" }) }}>
                    <div style={{ ...M, fontSize: "8px", fontWeight: 700, color: "var(--text-muted, #999)", letterSpacing: "0.1em", textTransform: "uppercase" }}>{s.label}</div>
                    <div style={{ ...M, fontSize: "24px", fontWeight: 800, marginTop: "4px" }}>{s.value}</div>
                    <div style={{ fontSize: "10px", color: "var(--text-muted, #aaa)", marginTop: "2px" }}>{s.sub}</div>
                  </div>
                ))}
              </div>
              {history.length > 0 && (
                <div style={{ ...card({ padding: "20px" }) }}>
                  <div style={{ ...M, fontSize: "11px", fontWeight: 700, marginBottom: "14px" }}>GRADE DISTRIBUTION</div>
                  <div style={{ display: "flex", gap: "8px", alignItems: "flex-end", height: "80px" }}>
                    {(["A", "B", "C", "D", "F"] as const).map(g => {
                      const count = gradeDistribution[g]; const pct = history.length > 0 ? (count / history.length) * 100 : 0;
                      return (<div key={g} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: "4px" }}>
                        <div style={{ ...M, fontSize: "10px", fontWeight: 700, color: "var(--text-muted, #888)" }}>{count}</div>
                        <div style={{ width: "100%", borderRadius: "4px 4px 0 0", background: gc(g), height: `${Math.max(pct, 4)}%`, minHeight: "3px", opacity: count > 0 ? 1 : 0.15, transition: "height 0.3s" }} />
                        <div style={{ ...M, fontSize: "11px", fontWeight: 800, color: gc(g) }}>{g}</div>
                      </div>);
                    })}
                  </div>
                </div>
              )}
              <div className="overview-grid">
                <div style={{ ...card({ padding: "20px" }) }}>
                  <div style={{ ...M, fontSize: "11px", fontWeight: 700, marginBottom: "12px" }}>RECENT SCANS</div>
                  {recentScans.length === 0 && <div style={{ fontSize: "12px", color: "var(--text-muted, #aaa)", padding: "12px 0" }}>No scans yet. <button onClick={() => setTab("scan")} style={{ background: "none", border: "none", color: "#9945FF", cursor: "pointer", fontWeight: 600, fontSize: "12px" }}>Start scanning →</button></div>}
                  {recentScans.map((h, i) => (
                    <div key={h.mint + i} onClick={() => window.open(`/?mint=${h.mint}`, "_blank")} style={{ display: "flex", alignItems: "center", gap: "10px", padding: "8px 0", borderTop: i > 0 ? "1px solid var(--border, rgba(0,0,0,0.04))" : "none", cursor: "pointer" }}>
                      <span style={{ ...M, fontSize: "16px", fontWeight: 800, color: gc(h.grade), minWidth: "28px" }}>{h.grade}</span>
                      <div style={{ flex: 1 }}><div style={{ fontSize: "12px", fontWeight: 600 }}>{h.symbol}</div><div style={{ ...M, fontSize: "9px", color: "var(--text-muted, #aaa)" }}>{h.score}/100 · {h.holders.toLocaleString()} holders</div></div>
                      <span style={{ ...M, fontSize: "10px", color: "var(--text-muted, #aaa)" }}>{timeAgo(h.timestamp)}</span>
                    </div>
                  ))}
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                  {bestScan && <div style={{ ...card({ padding: "16px", borderColor: "rgba(20,241,149,0.15)" }) }}><div style={{ ...M, fontSize: "9px", fontWeight: 700, color: "#14F195", letterSpacing: "0.08em" }}>CLEANEST</div><div style={{ display: "flex", alignItems: "center", gap: "10px", marginTop: "8px" }}><span style={{ ...M, fontSize: "24px", fontWeight: 800, color: gc(bestScan.grade) }}>{bestScan.grade}</span><div><div style={{ fontSize: "14px", fontWeight: 700 }}>{bestScan.symbol}</div><div style={{ ...M, fontSize: "10px", color: "var(--text-muted, #888)" }}>{bestScan.score}/100</div></div></div></div>}
                  {worstScan && worstScan.mint !== bestScan?.mint && <div style={{ ...card({ padding: "16px", borderColor: "rgba(239,68,68,0.12)" }) }}><div style={{ ...M, fontSize: "9px", fontWeight: 700, color: "#ef4444", letterSpacing: "0.08em" }}>RISKIEST</div><div style={{ display: "flex", alignItems: "center", gap: "10px", marginTop: "8px" }}><span style={{ ...M, fontSize: "24px", fontWeight: 800, color: gc(worstScan.grade) }}>{worstScan.grade}</span><div><div style={{ fontSize: "14px", fontWeight: 700 }}>{worstScan.symbol}</div><div style={{ ...M, fontSize: "10px", color: "var(--text-muted, #888)" }}>{worstScan.score}/100</div></div></div></div>}
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px" }}>
                    <button onClick={() => setTab("scan")} style={{ ...card({ padding: "14px", cursor: "pointer" }), ...M, fontSize: "11px", fontWeight: 700, color: "#9945FF", textAlign: "left" as const }}>⊕ New Scan</button>
                    <button onClick={() => setTab("bundlers")} style={{ ...card({ padding: "14px", cursor: "pointer" }), ...M, fontSize: "11px", fontWeight: 700, color: "var(--text-muted, #888)", textAlign: "left" as const }}>⬡ Feed</button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ═══ WATCHLIST ═══ */}
          {tab === "watchlist" && (
            <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "4px" }}>
                <div style={{ ...M, fontSize: "20px", fontWeight: 800, letterSpacing: "-0.02em" }}>Watchlist</div>
                <span style={{ ...M, fontSize: "11px", color: "var(--text-muted, #888)", background: subtleBg, padding: "4px 10px", borderRadius: "6px" }}>{watchlist.length}/{tier.name === "FREE" ? 3 : tier.name === "SCOUT" ? 10 : tier.name === "OPERATOR" ? 50 : 200} · {tier.name}</span>
              </div>
              {watchlist.length === 0 && <div style={{ ...card({ padding: "60px", textAlign: "center" }) }}><div style={{ fontSize: "36px", marginBottom: "10px", opacity: 0.3 }}>◉</div><div style={{ fontSize: "14px", fontWeight: 600, marginBottom: "4px" }}>No tokens watched</div><div style={{ fontSize: "12px", color: "var(--text-muted, #888)" }}>Scan a token and click &quot;+ Watch&quot;</div></div>}
              {watchlist.map(w => (
                <div key={w.mint} style={{ ...card({ padding: "16px 20px", display: "flex", alignItems: "center", justifyContent: "space-between" }) }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "14px" }}>
                    <span style={{ ...M, fontSize: "26px", fontWeight: 800, color: gc(w.lastGrade) }}>{w.lastGrade}</span>
                    <div><div style={{ fontSize: "15px", fontWeight: 700 }}>{w.symbol}</div><div style={{ ...M, fontSize: "10px", color: "var(--text-muted, #888)" }}>{w.lastScore}/100 · {w.lastHolders.toLocaleString()} holders · added {timeAgo(w.addedAt)}</div></div>
                  </div>
                  <div style={{ display: "flex", gap: "6px" }}>
                    <button onClick={() => window.open(`/?mint=${w.mint}`, "_blank")} style={{ ...M, padding: "7px 14px", background: darkMode ? "rgba(153,69,255,0.12)" : "rgba(153,69,255,0.06)", color: "#9945FF", border: "none", borderRadius: "8px", fontSize: "10px", fontWeight: 700, cursor: "pointer" }}>Rescan</button>
                    <button onClick={() => rmWatch(w.mint)} style={{ ...M, padding: "7px 14px", background: "rgba(239,68,68,0.04)", color: "#ef4444", border: "none", borderRadius: "8px", fontSize: "10px", fontWeight: 700, cursor: "pointer" }}>Remove</button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* ═══ HISTORY ═══ */}
          {tab === "history" && (
            <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
              <div className="history-header">
                <div style={{ ...M, fontSize: "20px", fontWeight: 800, letterSpacing: "-0.02em" }}>Scan History</div>
                <div style={{ display: "flex", gap: "6px", alignItems: "center" }}>
                  {history.length > 0 && <>
                    <input value={historySearch} onChange={e => setHistorySearch(e.target.value)} placeholder="Search..." className="manage-input" style={{ width: "160px" }} />
                    <button onClick={() => { setHistory([]); localStorage.removeItem("holdtech-history"); }} style={{ ...M, padding: "6px 12px", background: "rgba(239,68,68,0.04)", color: "#ef4444", border: "none", borderRadius: "8px", fontSize: "10px", fontWeight: 600, cursor: "pointer" }}>Clear</button>
                  </>}
                </div>
              </div>
              {history.length === 0 && <div style={{ ...card({ padding: "60px", textAlign: "center" }) }}><div style={{ fontSize: "36px", marginBottom: "10px", opacity: 0.3 }}>◷</div><div style={{ fontSize: "14px", fontWeight: 600, marginBottom: "4px" }}>No scans yet</div></div>}
              {filteredHistory.length > 0 && <div className="history-grid-header"><span></span><span>Token</span><span>Score</span><span>Holders</span><span>Top 5</span><span>Fresh</span><span>When</span></div>}
              {filteredHistory.map((h, i) => (
                <div key={h.mint + i} onClick={() => window.open(`/?mint=${h.mint}`, "_blank")} className="history-row" style={card()}>
                  <span style={{ ...M, fontSize: "16px", fontWeight: 800, color: gc(h.grade) }}>{h.grade}</span>
                  <div><div style={{ fontSize: "12px", fontWeight: 600 }}>{h.symbol}</div><div style={{ ...M, fontSize: "9px", color: "var(--text-muted, #aaa)" }}>{h.mint.slice(0, 6)}..{h.mint.slice(-4)}</div></div>
                  <span style={{ ...M, fontSize: "13px", fontWeight: 700 }}>{h.score}</span>
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
              <div style={{ ...M, fontSize: "20px", fontWeight: 800, letterSpacing: "-0.02em" }}>Batch Scan</div>
              <div style={{ ...card({ padding: "20px" }) }}>
                <div style={{ fontSize: "12px", color: "var(--text-muted, #888)", marginBottom: "12px" }}>Max {tier.name === "FREE" ? 2 : tier.name === "SCOUT" ? 5 : tier.name === "OPERATOR" ? 20 : 50} per batch ({tier.name} tier)</div>
                <textarea value={batchInput} onChange={e => setBatchInput(e.target.value)} placeholder="One per line or comma-separated..." className="manage-textarea" style={{ minHeight: "120px" }} spellCheck={false} />
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: "14px" }}>
                  <span style={{ ...M, fontSize: "11px", color: "var(--text-muted, #888)" }}>{batchInput.split(/[\n,]+/).filter(s => s.trim().length > 30).length} tokens</span>
                  <button onClick={handleBatch} disabled={batchScanning} className="btn-primary" style={{ ...M, opacity: batchScanning ? 0.5 : 1 }}>{batchScanning ? `Scanning ${progress}` : "SCAN ALL"}</button>
                </div>
              </div>
              {batchResults.length > 0 && [...batchResults].sort((a, b) => b.score - a.score).map(r => (
                <div key={r.mint} style={{ ...card({ display: "flex", alignItems: "center", gap: "14px", padding: "14px 18px" }) }}>
                  <span style={{ ...M, fontSize: "22px", fontWeight: 800, color: gc(r.grade) }}>{r.grade}</span>
                  <div style={{ flex: 1 }}><span style={{ fontSize: "14px", fontWeight: 700 }}>{r.symbol}</span></div>
                  <span style={{ ...M, fontSize: "13px", fontWeight: 700 }}>{r.score}/100</span>
                  <span style={{ ...M, fontSize: "11px", color: "var(--text-secondary, #666)" }}>{r.holders.toLocaleString()}</span>
                  <a href={`/?mint=${r.mint}`} target="_blank" style={{ ...M, fontSize: "11px", color: "#9945FF", textDecoration: "none", padding: "4px 10px", background: darkMode ? "rgba(153,69,255,0.12)" : "rgba(153,69,255,0.06)", borderRadius: "6px" }}>Full →</a>
                </div>
              ))}
            </div>
          )}

        </div>
      </div>

      {/* Mobile bottom nav */}
      <div className="mobile-bottom-nav">
        {tabs.slice(0, 4).map(t => (
          <button key={t.id} onClick={() => setTab(t.id)} style={{
            background: "none", border: "none", cursor: "pointer", display: "flex", flexDirection: "column",
            alignItems: "center", gap: "2px", fontSize: "16px", padding: "6px 0",
            color: tab === t.id ? "#9945FF" : "var(--text-muted, #aaa)", transition: "color 0.15s",
          }}>
            <span>{t.icon}</span>
            <span style={{ fontSize: "8px", fontWeight: 700, ...M }}>{t.label.split(" ")[0]}</span>
          </button>
        ))}
      </div>

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.4; } }
        @keyframes flash { 0% { background: rgba(20,241,149,0.15); } 100% { background: transparent; } }
        @keyframes slideIn { from { opacity: 0; transform: translateY(-8px); } to { opacity: 1; transform: translateY(0); } }
        @import url('https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500;600;700;800&display=swap');

        .grid-bg { position: fixed; inset: 0; z-index: 0; pointer-events: none; background-image: linear-gradient(rgba(153,69,255,0.04) 1px, transparent 1px), linear-gradient(90deg, rgba(153,69,255,0.04) 1px, transparent 1px); background-size: 48px 48px; mask-image: linear-gradient(to bottom, black 50%, transparent 100%); -webkit-mask-image: linear-gradient(to bottom, black 50%, transparent 100%); }

        .sidebar { width: 230px; flex-shrink: 0; padding: 20px 14px; display: flex; flex-direction: column; gap: 2px; border-right: 1px solid var(--border, rgba(153,69,255,0.06)); background: var(--card-bg, rgba(255,255,255,0.25)); backdrop-filter: blur(12px); position: sticky; top: 0; height: 100vh; overflow-y: auto; }
        .sidebar-logo { display: flex; align-items: center; gap: 10px; text-decoration: none; padding: 6px 12px; margin-bottom: 20px; }
        .main-content { flex: 1; padding: 28px 36px; max-width: 900px; min-height: 100vh; }

        .mobile-header { display: none; }
        .mobile-overlay { display: none; }
        .mobile-bottom-nav { display: none; }

        .feed-header { display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 12px; }
        .feed-controls { display: flex; gap: 6px; align-items: center; flex-wrap: wrap; }
        .stats-grid { display: grid; grid-template-columns: repeat(5, 1fr); gap: 10px; }
        .overview-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
        .metrics-grid { display: grid; grid-template-columns: repeat(5, 1fr); gap: 10px; }
        .inline-scan-grid { display: grid; grid-template-columns: auto repeat(5, 1fr); gap: 10px; align-items: center; }
        .scan-result-header { display: flex; align-items: flex-start; justify-content: space-between; margin-bottom: 20px; flex-wrap: wrap; gap: 12px; }
        .history-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 4px; flex-wrap: wrap; gap: 8px; }
        .history-grid-header { display: grid; grid-template-columns: 36px 1fr 64px 64px 56px 56px 72px; gap: 6px; padding: 6px 16px; font-family: 'JetBrains Mono', monospace; font-size: 8px; color: var(--text-muted, #888); letter-spacing: 0.08em; text-transform: uppercase; font-weight: 700; }
        .history-row { display: grid; grid-template-columns: 36px 1fr 64px 64px 56px 56px 72px; gap: 6px; align-items: center; padding: 11px 16px; cursor: pointer; transition: transform 0.1s; }

        .feed-item { transition: transform 0.1s, box-shadow 0.15s; }
        .feed-item:hover { transform: translateX(2px); box-shadow: 0 2px 12px rgba(153,69,255,0.06); }
        .feed-item-new { animation: flash 2s ease-out, slideIn 0.3s ease-out; }
        .feed-item-links { display: flex; flex-direction: column; gap: 4px; flex-shrink: 0; }

        .live-dot { animation: pulse 1.5s infinite; }

        .spinner { display: inline-block; width: 28px; height: 28px; border: 3px solid rgba(153,69,255,0.12); border-top-color: #9945FF; border-radius: 50%; animation: spin 1s linear infinite; }

        .skeleton-row { display: flex; align-items: center; gap: 12px; padding: 14px 16px; border-radius: 14px; background: var(--card-bg, rgba(255,255,255,0.6)); border: 1px solid var(--border, rgba(153,69,255,0.08)); animation: pulse 1.5s ease-in-out infinite; }

        .manage-input { padding: 9px 12px; border: 1px solid var(--border, rgba(153,69,255,0.12)); border-radius: 10px; font-size: 11px; font-family: 'JetBrains Mono', monospace; outline: none; background: var(--card-bg, rgba(255,255,255,0.8)); color: var(--text, #1a1a2e); }
        .manage-textarea { width: 100%; padding: 10px; border: 1px solid var(--border, rgba(153,69,255,0.1)); border-radius: 10px; font-size: 10px; font-family: 'JetBrains Mono', monospace; outline: none; min-height: 50px; resize: vertical; background: var(--card-bg, rgba(255,255,255,0.8)); color: var(--text, #1a1a2e); }
        .scan-input { flex: 1; padding: 13px 16px; border: 1px solid var(--border, rgba(153,69,255,0.15)); border-radius: 12px; font-size: 13px; font-family: 'JetBrains Mono', monospace; outline: none; background: var(--card-bg, rgba(255,255,255,0.8)); color: var(--text, #1a1a2e); min-width: 0; }
        .btn-primary { padding: 9px 16px; background: linear-gradient(135deg, #9945FF, #7B3FE4); color: white; border: none; border-radius: 10px; font-size: 10px; font-weight: 700; cursor: pointer; }

        .wallet-row { display: flex; align-items: center; justify-content: space-between; padding: 5px 2px; font-size: 11px; border-bottom: 1px solid rgba(0,0,0,0.02); }

        .coordinated-alert { animation: slideIn 0.4s ease-out; }

        ::-webkit-scrollbar { width: 6px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: rgba(153,69,255,0.15); border-radius: 3px; }
        ::-webkit-scrollbar-thumb:hover { background: rgba(153,69,255,0.25); }

        /* ═══ DARK MODE ═══ */
        [data-theme="dark"] .sidebar { background: rgba(14,14,30,0.85); border-color: rgba(153,69,255,0.1); }
        [data-theme="dark"] .skeleton-row { background: rgba(22,22,42,0.7); border-color: rgba(153,69,255,0.12); }
        [data-theme="dark"] .manage-input,
        [data-theme="dark"] .manage-textarea,
        [data-theme="dark"] .scan-input { background: rgba(22,22,42,0.8); color: #e8eaf0; border-color: rgba(153,69,255,0.2); }
        [data-theme="dark"] .mobile-header { background: rgba(14,14,30,0.9); }
        [data-theme="dark"] .mobile-bottom-nav { background: rgba(14,14,30,0.95); }
        [data-theme="dark"] .wallet-row { border-color: rgba(255,255,255,0.04); }
        [data-theme="dark"] .feed-item:hover { box-shadow: 0 2px 12px rgba(0,0,0,0.3); }

        /* ═══ MOBILE ═══ */
        @media (max-width: 768px) {
          .sidebar { position: fixed; left: -260px; top: 0; bottom: 0; z-index: 100; width: 260px; transition: left 0.25s ease; }
          .sidebar-open { left: 0; box-shadow: 4px 0 24px rgba(0,0,0,0.15); }
          .mobile-overlay { display: block; position: fixed; inset: 0; z-index: 99; background: rgba(0,0,0,0.3); }
          .mobile-header { display: flex; align-items: center; justify-content: space-between; padding: 12px 16px; background: var(--card-bg, rgba(255,255,255,0.8)); backdrop-filter: blur(12px); border-bottom: 1px solid var(--border, rgba(153,69,255,0.06)); position: sticky; top: 0; z-index: 50; }
          .mobile-bottom-nav { display: flex; position: fixed; bottom: 0; left: 0; right: 0; z-index: 50; justify-content: space-around; padding: 8px 16px 20px; background: var(--card-bg, rgba(255,255,255,0.9)); backdrop-filter: blur(16px); border-top: 1px solid var(--border, rgba(153,69,255,0.06)); }
          .main-content { padding: 16px; padding-bottom: 80px; padding-top: 8px; max-width: 100%; }
          .stats-grid { grid-template-columns: repeat(2, 1fr) !important; }
          .overview-grid { grid-template-columns: 1fr !important; }
          .metrics-grid { grid-template-columns: repeat(3, 1fr) !important; }
          .inline-scan-grid { grid-template-columns: repeat(3, 1fr) !important; }
          .inline-scan-grid > div:first-child { grid-column: 1 / -1 !important; grid-row: auto !important; }
          .history-grid-header { display: none; }
          .history-row { grid-template-columns: 36px 1fr 50px !important; }
          .history-row > span:nth-child(n+4) { display: none; }
          .feed-controls { width: 100%; justify-content: flex-end; }
          .feed-item-links { flex-direction: row; }
          .scan-result-header { flex-direction: column; }
        }

        @media (max-width: 480px) {
          .stats-grid { grid-template-columns: 1fr 1fr !important; }
          .stats-grid > div:last-child { grid-column: 1 / -1; }
          .metrics-grid { grid-template-columns: repeat(2, 1fr) !important; }
        }
      `}</style>
    </div>
  );
}
