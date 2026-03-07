"use client";
import { useWallet } from "@solana/wallet-adapter-react";
import { WalletMultiButton } from "@solana/wallet-adapter-react-ui";
import { useConnection } from "@solana/wallet-adapter-react";
import { PublicKey } from "@solana/web3.js";
import { useState, useEffect, useCallback, useRef } from "react";

// Config — update mint when token launches
const HOLDTECH_MINT = ""; // empty = demo mode (no token yet)
const TIERS = [
  { name: "FREE", min: 0, color: "#888" },
  { name: "SCOUT", min: 5_000_000, color: "#9945FF" },
  { name: "OPERATOR", min: 10_000_000, color: "#9945FF" },
  { name: "WHALE", min: 20_000_000, color: "#14F195" },
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

function getTier(balance: number) {
  let tier = TIERS[0];
  for (const t of TIERS) { if (balance >= t.min) tier = t; }
  return tier;
}

function timeAgo(ts: number) {
  const diff = Date.now() - ts;
  if (diff < 60000) return "just now";
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
  return `${Math.floor(diff / 86400000)}d ago`;
}

function gradeColor(g: string) {
  if (g?.startsWith("A")) return "#14F195";
  if (g?.startsWith("B")) return "#4ade80";
  if (g?.startsWith("C")) return "#eab308";
  if (g?.startsWith("D")) return "#f97316";
  return "#ef4444";
}

export default function Dashboard() {
  const { publicKey, connected } = useWallet();
  const { connection } = useConnection();
  const [tokenBalance, setTokenBalance] = useState<number>(0);
  const [tab, setTab] = useState<"scan" | "watchlist" | "history" | "batch" | "bundlers">("scan");
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
  const historyRef = useRef(history);
  historyRef.current = history;
  const intervalRef = useRef<any>(null);

  // Load persisted data
  useEffect(() => {
    try {
      setHistory(JSON.parse(localStorage.getItem("holdtech-history") || "[]"));
      setWatchlist(JSON.parse(localStorage.getItem("holdtech-watchlist") || "[]"));
      setBundlers(JSON.parse(localStorage.getItem("holdtech-bundlers") || "[]"));
      const theme = localStorage.getItem("holdtech-theme");
      if (theme === "dark") { setDarkMode(true); document.documentElement.setAttribute("data-theme", "dark"); }
    } catch {}
  }, []);

  // Check token balance
  useEffect(() => {
    if (!connected || !publicKey || !HOLDTECH_MINT) {
      setTokenBalance(HOLDTECH_MINT ? 0 : 999_999_999);
      return;
    }
    (async () => {
      try {
        const mint = new PublicKey(HOLDTECH_MINT);
        const accounts = await connection.getParsedTokenAccountsByOwner(publicKey, { mint });
        const bal = accounts.value.reduce((sum, a) => sum + (a.account.data.parsed?.info?.tokenAmount?.uiAmount || 0), 0);
        setTokenBalance(bal);
      } catch { setTokenBalance(0); }
    })();
  }, [connected, publicKey, connection]);

  const tier = getTier(tokenBalance);
  const isDemo = !HOLDTECH_MINT;

  const toggleTheme = () => {
    const next = !darkMode;
    setDarkMode(next);
    document.documentElement.setAttribute("data-theme", next ? "dark" : "");
    localStorage.setItem("holdtech-theme", next ? "dark" : "light");
  };

  // ── Scan logic ──
  const runScan = useCallback(async (mint: string): Promise<ScanResult | null> => {
    try {
      const [analyzeRes, countRes] = await Promise.all([
        fetch("/api/analyze", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ mint }) }),
        fetch("/api/holder-count", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ mint }) }),
      ]);
      if (!analyzeRes.ok) return null;
      const analysis = await analyzeRes.json();
      const countData = countRes.ok ? await countRes.json() : { count: null };
      const w = analysis.wallets || [];
      const supply = analysis.totalSupply || 1;
      const wLen = w.length || 1;
      const top5 = w.slice(0, 5).reduce((s: number, x: any) => s + (x.balance || 0), 0);
      const metrics = {
        avgWalletAgeDays: parseFloat((w.reduce((s: number, x: any) => s + (x.walletAgeDays || 0), 0) / wLen).toFixed(1)),
        medianWalletAgeDays: parseFloat((w.map((x: any) => x.walletAgeDays || 0).sort((a: number, b: number) => a - b)[Math.floor(wLen / 2)] || 0).toFixed(1)),
        freshWalletPct: parseFloat(((w.filter((x: any) => x.walletAgeDays !== undefined && x.walletAgeDays < 7).length / wLen) * 100).toFixed(1)),
        veryFreshWalletPct: parseFloat(((w.filter((x: any) => x.walletAgeDays !== undefined && x.walletAgeDays < 1).length / wLen) * 100).toFixed(1)),
        diamondHandsPct: parseFloat(((w.filter((x: any) => (x.holdDurationDays || 0) > 2).length / wLen) * 100).toFixed(1)),
        veteranHolderPct: parseFloat(((w.filter((x: any) => (x.walletAgeDays || 0) >= 90).length / wLen) * 100).toFixed(1)),
        ogHolderPct: parseFloat(((w.filter((x: any) => (x.walletAgeDays || 0) >= 180).length / wLen) * 100).toFixed(1)),
        avgTxCount: parseFloat((w.reduce((s: number, x: any) => s + (x.txCount || 0), 0) / wLen).toFixed(0)),
        lowActivityPct: parseFloat(((w.filter((x: any) => (x.txCount || 0) < 10).length / wLen) * 100).toFixed(1)),
        avgSolBalance: parseFloat((w.reduce((s: number, x: any) => s + (x.solBalance || 0), 0) / wLen).toFixed(2)),
        singleTokenPct: parseFloat(((w.filter((x: any) => (x.tokenCount || 0) <= 1).length / wLen) * 100).toFixed(1)),
      };
      const verdictRes = await fetch("/api/ai-verdict", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ metrics, totalHolders: countData.count || wLen, analyzedHolders: wLen, tokenSymbol: analysis.tokenSymbol }),
      });
      const verdict = verdictRes.ok ? await verdictRes.json() : null;
      return {
        mint, symbol: analysis.tokenSymbol || mint.slice(0, 6), score: verdict?.score ?? 0,
        grade: verdict?.grade || "?", holders: countData.count || w.length,
        top5Pct: parseFloat(((top5 / supply) * 100).toFixed(1)),
        freshPct: w.length > 0 ? parseFloat(((w.filter((x: any) => x.walletAgeDays !== undefined && x.walletAgeDays < 7).length / w.length) * 100).toFixed(0)) : 0,
        avgAge: w.length > 0 ? Math.round(w.reduce((s: number, x: any) => s + (x.walletAgeDays || 0), 0) / w.length) : 0,
        timestamp: Date.now(),
      };
    } catch { return null; }
  }, []);

  const handleScan = async () => {
    if (!scanInput.trim() || scanning) return;
    setScanning(true); setProgress("Analyzing holders..."); setScanResult(null);
    const result = await runScan(scanInput.trim());
    if (result) {
      setScanResult(result);
      const newHistory = [result, ...historyRef.current.filter(h => h.mint !== result.mint)].slice(0, 50);
      setHistory(newHistory);
      localStorage.setItem("holdtech-history", JSON.stringify(newHistory));
    }
    setScanning(false); setProgress("");
  };

  const handleBatch = async () => {
    const mints = batchInput.split(/[\n,]+/).map(s => s.trim()).filter(s => s.length > 30);
    if (!mints.length || batchScanning) return;
    const limit = tier.name === "FREE" ? 2 : tier.name === "SCOUT" ? 5 : tier.name === "OPERATOR" ? 20 : 50;
    const toScan = mints.slice(0, limit);
    setBatchScanning(true); setBatchResults([]);
    const results: ScanResult[] = [];
    for (let i = 0; i < toScan.length; i++) {
      setProgress(`Scanning ${i + 1}/${toScan.length}...`);
      const r = await runScan(toScan[i]);
      if (r) { results.push(r); setBatchResults([...results]); }
    }
    setBatchScanning(false); setProgress("");
  };

  const addToWatchlist = (result: ScanResult) => {
    if (watchlist.find(w => w.mint === result.mint)) return;
    const limit = tier.name === "FREE" ? 3 : tier.name === "SCOUT" ? 10 : tier.name === "OPERATOR" ? 50 : 200;
    if (watchlist.length >= limit) return;
    const item: WatchlistItem = { mint: result.mint, symbol: result.symbol, lastScore: result.score, lastGrade: result.grade, lastHolders: result.holders, addedAt: Date.now(), history: [{ score: result.score, timestamp: Date.now() }] };
    const newWl = [...watchlist, item];
    setWatchlist(newWl);
    localStorage.setItem("holdtech-watchlist", JSON.stringify(newWl));
  };

  const removeFromWatchlist = (mint: string) => {
    const newWl = watchlist.filter(w => w.mint !== mint);
    setWatchlist(newWl);
    localStorage.setItem("holdtech-watchlist", JSON.stringify(newWl));
  };

  // ── Bundler feed ──
  const fetchFeed = useCallback(async () => {
    if (bundlers.length === 0) return;
    setFeedLoading(true);
    try {
      const allEvents: FeedEvent[] = [];
      for (let i = 0; i < bundlers.length; i += 10) {
        const batch = bundlers.slice(i, i + 10).map(b => ({ address: b.address, name: b.label || b.address.slice(0, 8), emoji: b.emoji || "🚩", group: b.group || "tracked" }));
        const res = await fetch("/api/bundler-feed", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ wallets: batch }) });
        if (res.ok) { const data = await res.json(); allEvents.push(...(data.events || [])); }
      }
      allEvents.sort((a, b) => b.timestamp - a.timestamp);
      setFeedEvents(allEvents.slice(0, 200));
    } catch {}
    setFeedLoading(false);
  }, [bundlers]);

  useEffect(() => {
    if (tab === "bundlers" && bundlers.length > 0 && feedEvents.length === 0) fetchFeed();
  }, [tab, bundlers.length]);

  useEffect(() => {
    if (autoRefresh && tab === "bundlers") {
      intervalRef.current = setInterval(fetchFeed, 30000);
      return () => clearInterval(intervalRef.current);
    } else { if (intervalRef.current) clearInterval(intervalRef.current); }
  }, [autoRefresh, tab, fetchFeed]);

  const loadDefaults = async () => {
    try {
      const res = await fetch("/bundlers-default.json");
      const data = await res.json();
      const existing = new Set(bundlers.map(b => b.address));
      const newOnes = data.filter((d: any) => !existing.has(d.address)).map((d: any) => ({ address: d.address, label: d.name, emoji: d.emoji, group: d.group, addedAt: Date.now(), seenIn: [] as string[] }));
      const newB = [...bundlers, ...newOnes];
      setBundlers(newB);
      localStorage.setItem("holdtech-bundlers", JSON.stringify(newB));
    } catch {}
  };

  // ── GATE ──
  if (!isDemo && !connected) {
    return (
      <div style={{ minHeight: "100vh", background: "var(--bg, #f0f0f6)", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: "24px", fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif" }}>
        <a href="/" style={{ display: "flex", alignItems: "center", gap: "8px", textDecoration: "none" }}>
          <img src="/logo.png" alt="" width={32} height={32} />
          <span style={{ fontSize: "22px", fontWeight: 800 }}><span style={{ color: "#9945FF" }}>HOLD</span><span style={{ color: "#888" }}>TECH</span></span>
        </a>
        <div style={{ textAlign: "center", maxWidth: "400px" }}>
          <div style={{ fontSize: "14px", color: "#888", marginBottom: "24px", lineHeight: 1.6 }}>Connect your wallet to access the dashboard. Hold $HOLDTECH to unlock premium features.</div>
          <WalletMultiButton />
        </div>
      </div>
    );
  }

  const navLink = (href: string, label: string, active: boolean) => (
    <a href={href} style={{ fontFamily: "'Courier New', monospace", fontSize: "11px", fontWeight: 600, padding: "3px 10px", borderRadius: "6px", color: active ? "var(--accent, #9945FF)" : "var(--text-muted, #888)", background: active ? "rgba(153,69,255,0.08)" : "transparent", textDecoration: "none", transition: "all 0.15s" }}>{label}</a>
  );

  const tabBtn = (id: typeof tab, label: string, count?: number) => (
    <button key={id} onClick={() => setTab(id)} style={{ fontFamily: "'Courier New', monospace", padding: "8px 14px", fontSize: "11px", fontWeight: 700, cursor: "pointer", border: "none", borderBottom: tab === id ? "2px solid var(--accent, #9945FF)" : "2px solid transparent", background: "none", color: tab === id ? "var(--accent, #9945FF)" : "var(--text-muted, #888)", transition: "all 0.15s" }}>{label}{count !== undefined ? ` (${count})` : ""}</button>
  );

  const card = { background: "var(--card-bg, rgba(255,255,255,0.6))", backdropFilter: "blur(12px)", border: "1px solid var(--border, rgba(153,69,255,0.1))", borderRadius: "14px", padding: "20px" };
  const mono = { fontFamily: "'Courier New', monospace" };
  const input = { width: "100%", padding: "10px 12px", border: "1px solid var(--border, rgba(153,69,255,0.15))", borderRadius: "10px", fontSize: "12px", background: "var(--input-bg, rgba(255,255,255,0.8))", fontFamily: "'Courier New', monospace", outline: "none", color: "var(--text, #1a1a2e)" };
  const btn = { padding: "8px 16px", background: "linear-gradient(135deg, #9945FF, #7B3FE4)", color: "white", border: "none", borderRadius: "10px", fontSize: "11px", fontWeight: 700, cursor: "pointer", fontFamily: "'Courier New', monospace" };
  const btnOut = { padding: "6px 12px", background: "transparent", color: "var(--accent, #9945FF)", border: "1px solid rgba(153,69,255,0.2)", borderRadius: "8px", fontSize: "10px", fontWeight: 600, cursor: "pointer", fontFamily: "'Courier New', monospace" };
  const metricLabel = { fontSize: "9px", color: "var(--text-muted, #888)", textTransform: "uppercase" as const, ...mono, letterSpacing: "0.05em" };
  const metricVal = { fontSize: "18px", fontWeight: 700, color: "var(--text, #1a1a2e)", ...mono, marginTop: "2px" };

  return (
    <div style={{ minHeight: "100vh", background: "var(--bg, #f0f0f6)", fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif", color: "var(--text, #1a1a2e)" }}>
      {/* Grid bg */}
      <div style={{ position: "fixed", inset: 0, zIndex: 0, pointerEvents: "none", backgroundImage: "linear-gradient(rgba(153,69,255,0.06) 1px, transparent 1px), linear-gradient(90deg, rgba(153,69,255,0.06) 1px, transparent 1px)", backgroundSize: "40px 40px", maskImage: "linear-gradient(to bottom, black 60%, transparent 100%)", WebkitMaskImage: "linear-gradient(to bottom, black 60%, transparent 100%)" }} />

      <div style={{ position: "relative", zIndex: 1, maxWidth: "960px", margin: "0 auto", padding: "0 20px" }}>
        {/* ═══ NAV ═══ */}
        <div className="glass" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 24px", borderRadius: "16px", marginTop: "16px", background: "var(--card-bg, rgba(255,255,255,0.6))", backdropFilter: "blur(12px)", border: "1px solid var(--border, rgba(153,69,255,0.1))" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
            <a href="/" style={{ display: "flex", alignItems: "center", gap: "8px", textDecoration: "none" }}>
              <img src="/logo.png" alt="HoldTech" width={28} height={28} style={{ objectFit: "contain" }} />
              <span style={{ fontSize: "20px", fontWeight: 800 }}><span style={{ color: "var(--accent, #9945FF)" }}>HOLD</span><span style={{ color: "var(--text-muted, #888)" }}>TECH</span></span>
            </a>
            <span style={{ ...mono, fontSize: "10px", fontWeight: 700, color: tier.color, padding: "3px 8px", borderRadius: "6px", border: `1px solid ${tier.color}33`, background: `${tier.color}0a` }}>{tier.name}{isDemo && " · DEMO"}</span>
            {navLink("/", "HOME", false)}
            {navLink("/docs", "DOCS", false)}
            {navLink("/dashboard", "DASHBOARD", true)}
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "4px" }}>
            <button onClick={toggleTheme} style={{ display: "flex", alignItems: "center", justifyContent: "center", width: 36, height: 36, borderRadius: "10px", background: "none", border: "none", cursor: "pointer", color: "var(--text-muted, #888)", fontSize: "18px" }}>{darkMode ? "☀️" : "🌙"}</button>
            {!isDemo && <WalletMultiButton style={{ fontSize: "10px" }} />}
          </div>
        </div>

        {/* ═══ TABS ═══ */}
        <div style={{ display: "flex", gap: "4px", padding: "16px 0 12px", borderBottom: "1px solid var(--border, rgba(153,69,255,0.08))", marginBottom: "16px" }}>
          {tabBtn("scan", "SCAN")}
          {tabBtn("watchlist", "WATCHLIST", watchlist.length)}
          {tabBtn("history", "HISTORY", history.length)}
          {tabBtn("batch", "BATCH")}
          {tabBtn("bundlers", "🔩 BUNDLERS", bundlers.length)}
        </div>

        {/* ═══ SCAN ═══ */}
        {tab === "scan" && (
          <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
            <div style={{ display: "flex", gap: "8px" }}>
              <input value={scanInput} onChange={e => setScanInput(e.target.value)} onKeyDown={e => e.key === "Enter" && handleScan()} placeholder="Paste token address..." style={input} spellCheck={false} />
              <button onClick={handleScan} disabled={scanning} style={{ ...btn, opacity: scanning ? 0.5 : 1 }}>{scanning ? "..." : "SCAN"}</button>
            </div>
            {scanning && <div style={{ textAlign: "center", padding: "32px", color: "var(--text-muted, #888)", fontSize: "13px" }}><div className="spinner" style={{ display: "inline-block", width: 24, height: 24, border: "2px solid rgba(153,69,255,0.15)", borderTopColor: "#9945FF", borderRadius: "50%", animation: "spin 1s linear infinite", marginBottom: "8px" }} /><br/>{progress}</div>}
            {scanResult && (
              <div style={card}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "16px" }}>
                  <div>
                    <div style={{ fontSize: "18px", fontWeight: 700 }}>{scanResult.symbol}</div>
                    <div style={{ ...mono, fontSize: "10px", color: "var(--text-muted, #888)" }}>{scanResult.mint.slice(0, 12)}...{scanResult.mint.slice(-6)}</div>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                    <button onClick={() => addToWatchlist(scanResult)} style={btnOut}>+ Watch</button>
                    <a href={`/?mint=${scanResult.mint}`} target="_blank" style={{ ...btnOut, textDecoration: "none" }}>Full Analysis →</a>
                    <div style={{ ...mono, fontSize: "28px", fontWeight: 800, padding: "4px 16px", borderRadius: "10px", background: `${gradeColor(scanResult.grade)}18`, color: gradeColor(scanResult.grade) }}>{scanResult.grade}</div>
                  </div>
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: "10px" }}>
                  {[{ l: "Score", v: `${scanResult.score}/100` }, { l: "Holders", v: scanResult.holders.toLocaleString() }, { l: "Top 5", v: `${scanResult.top5Pct}%` }, { l: "Fresh", v: `${scanResult.freshPct}%` }, { l: "Avg Age", v: `${scanResult.avgAge}d` }].map(m => (
                    <div key={m.l} style={{ background: "rgba(153,69,255,0.03)", borderRadius: "10px", padding: "12px" }}>
                      <div style={metricLabel}>{m.l}</div>
                      <div style={metricVal}>{m.v}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* ═══ WATCHLIST ═══ */}
        {tab === "watchlist" && (
          <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
            {watchlist.length === 0 && <div style={{ textAlign: "center", padding: "48px", color: "var(--text-muted, #aaa)", fontSize: "13px" }}><div style={{ fontSize: "32px", marginBottom: "8px", opacity: 0.5 }}>👁️</div>No tokens watched. Scan a token and click &quot;+ Watch&quot;.</div>}
            {watchlist.map(w => (
              <div key={w.mint} style={{ ...card, display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 20px" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "14px" }}>
                  <div style={{ ...mono, fontSize: "22px", fontWeight: 800, color: gradeColor(w.lastGrade), minWidth: "36px" }}>{w.lastGrade}</div>
                  <div>
                    <div style={{ fontSize: "14px", fontWeight: 700 }}>{w.symbol}</div>
                    <div style={{ ...mono, fontSize: "10px", color: "var(--text-muted, #888)" }}>{w.mint.slice(0, 8)}...{w.mint.slice(-6)}</div>
                  </div>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
                  <div style={{ textAlign: "right" }}>
                    <div style={{ ...mono, fontSize: "14px", fontWeight: 700 }}>{w.lastScore}/100</div>
                    <div style={{ fontSize: "10px", color: "var(--text-muted, #888)" }}>{w.lastHolders.toLocaleString()} holders</div>
                  </div>
                  <button onClick={() => { setScanInput(w.mint); setTab("scan"); }} style={btnOut}>Rescan</button>
                  <button onClick={() => removeFromWatchlist(w.mint)} style={{ ...btnOut, color: "#ef4444", borderColor: "rgba(239,68,68,0.2)" }}>×</button>
                </div>
              </div>
            ))}
            {watchlist.length > 0 && <div style={{ fontSize: "10px", color: "var(--text-muted, #888)", textAlign: "center", padding: "8px" }}>{watchlist.length}/{tier.name === "FREE" ? 3 : tier.name === "SCOUT" ? 10 : tier.name === "OPERATOR" ? 50 : 200} slots · {tier.name}</div>}
          </div>
        )}

        {/* ═══ HISTORY ═══ */}
        {tab === "history" && (
          <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
            {history.length === 0 && <div style={{ textAlign: "center", padding: "48px", color: "var(--text-muted, #aaa)", fontSize: "13px" }}><div style={{ fontSize: "32px", marginBottom: "8px", opacity: 0.5 }}>📜</div>No scan history.</div>}
            {history.length > 0 && <div style={{ display: "grid", gridTemplateColumns: "40px 1fr 70px 60px 60px 60px 80px", gap: "8px", padding: "8px 16px", ...mono, fontSize: "9px", color: "var(--text-muted, #888)", letterSpacing: "0.05em", textTransform: "uppercase" as const }}><span>Grade</span><span>Token</span><span>Score</span><span>Holders</span><span>Top 5</span><span>Fresh</span><span>When</span></div>}
            {history.map((h, i) => (
              <div key={`${h.mint}-${i}`} onClick={() => { setScanInput(h.mint); setTab("scan"); }} style={{ ...card, display: "grid", gridTemplateColumns: "40px 1fr 70px 60px 60px 60px 80px", gap: "8px", alignItems: "center", padding: "10px 16px", cursor: "pointer" }}>
                <span style={{ ...mono, fontSize: "14px", fontWeight: 800, color: gradeColor(h.grade) }}>{h.grade}</span>
                <div><div style={{ fontSize: "13px", fontWeight: 600 }}>{h.symbol}</div><div style={{ ...mono, fontSize: "9px", color: "var(--text-muted, #aaa)" }}>{h.mint.slice(0, 6)}...{h.mint.slice(-4)}</div></div>
                <span style={{ ...mono, fontSize: "13px", fontWeight: 700 }}>{h.score}/100</span>
                <span style={{ ...mono, fontSize: "12px", color: "var(--text-secondary, #666)" }}>{h.holders.toLocaleString()}</span>
                <span style={{ ...mono, fontSize: "12px", color: "var(--text-secondary, #666)" }}>{h.top5Pct}%</span>
                <span style={{ ...mono, fontSize: "12px", color: h.freshPct > 40 ? "#ef4444" : "var(--text-secondary, #666)" }}>{h.freshPct}%</span>
                <span style={{ fontSize: "10px", color: "var(--text-muted, #aaa)" }}>{timeAgo(h.timestamp)}</span>
              </div>
            ))}
            {history.length > 0 && <button onClick={() => { setHistory([]); localStorage.removeItem("holdtech-history"); }} style={{ ...btnOut, alignSelf: "center", marginTop: "8px", color: "var(--text-muted, #888)", borderColor: "rgba(0,0,0,0.08)" }}>Clear History</button>}
          </div>
        )}

        {/* ═══ BATCH ═══ */}
        {tab === "batch" && (
          <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
            <div style={card}>
              <div style={{ ...mono, fontSize: "12px", fontWeight: 700, marginBottom: "4px" }}>BATCH SCAN</div>
              <div style={{ fontSize: "11px", color: "var(--text-muted, #888)", marginBottom: "12px" }}>Paste multiple token addresses. Max {tier.name === "FREE" ? 2 : tier.name === "SCOUT" ? 5 : tier.name === "OPERATOR" ? 20 : 50} per batch ({tier.name}).</div>
              <textarea value={batchInput} onChange={e => setBatchInput(e.target.value)} placeholder={"Token addresses...\nOne per line or comma-separated"} style={{ ...input, minHeight: "100px", resize: "vertical" } as any} spellCheck={false} />
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: "12px" }}>
                <span style={{ fontSize: "11px", color: "var(--text-muted, #888)" }}>{batchInput.split(/[\n,]+/).filter(s => s.trim().length > 30).length} tokens</span>
                <button onClick={handleBatch} disabled={batchScanning} style={{ ...btn, opacity: batchScanning ? 0.5 : 1 }}>{batchScanning ? progress : "SCAN ALL"}</button>
              </div>
            </div>
            {batchResults.length > 0 && (
              <div style={card}>
                <div style={{ ...mono, fontSize: "12px", fontWeight: 700, marginBottom: "12px" }}>RESULTS ({batchResults.length})</div>
                {[...batchResults].sort((a, b) => b.score - a.score).map((r, i) => (
                  <div key={r.mint} style={{ display: "grid", gridTemplateColumns: "40px 1fr 70px 60px 60px 60px", gap: "8px", alignItems: "center", padding: "8px 0", borderTop: i > 0 ? "1px solid var(--border, rgba(153,69,255,0.06))" : "none" }}>
                    <span style={{ ...mono, fontSize: "16px", fontWeight: 800, color: gradeColor(r.grade) }}>{r.grade}</span>
                    <div><span style={{ fontSize: "13px", fontWeight: 600 }}>{r.symbol}</span><a href={`/?mint=${r.mint}`} target="_blank" style={{ fontSize: "9px", color: "#9945FF", marginLeft: "6px" }}>→</a></div>
                    <span style={{ ...mono, fontSize: "13px", fontWeight: 700 }}>{r.score}/100</span>
                    <span style={{ ...mono, fontSize: "12px", color: "var(--text-secondary, #666)" }}>{r.holders.toLocaleString()}</span>
                    <span style={{ ...mono, fontSize: "12px", color: "var(--text-secondary, #666)" }}>{r.top5Pct}%</span>
                    <span style={{ ...mono, fontSize: "12px", color: r.freshPct > 40 ? "#ef4444" : "var(--text-secondary, #666)" }}>{r.freshPct}%</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ═══ BUNDLERS ═══ */}
        {tab === "bundlers" && (
          <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
            {/* Header */}
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <span style={{ ...mono, fontSize: "12px", fontWeight: 700 }}>LIVE FEED</span>
                <span style={{ fontSize: "11px", color: "var(--text-muted, #888)" }}>{bundlers.length} wallets</span>
              </div>
              <div style={{ display: "flex", gap: "6px" }}>
                <button onClick={() => setAutoRefresh(!autoRefresh)} style={{ ...btnOut, color: autoRefresh ? "#14F195" : "var(--text-muted, #888)", borderColor: autoRefresh ? "rgba(20,241,149,0.3)" : "var(--border, rgba(0,0,0,0.1))" }}>{autoRefresh ? "● LIVE" : "○ AUTO"}</button>
                <button onClick={fetchFeed} disabled={feedLoading} style={{ ...btnOut, opacity: feedLoading ? 0.5 : 1 }}>{feedLoading ? "..." : "Refresh"}</button>
                <button onClick={() => setShowManage(!showManage)} style={btnOut}>{showManage ? "Hide" : "Manage"}</button>
              </div>
            </div>

            {/* Manage panel */}
            {showManage && (
              <div style={card}>
                <div style={{ display: "flex", gap: "8px", marginBottom: "10px" }}>
                  <input value={bundlerInput} onChange={e => setBundlerInput(e.target.value)} placeholder="Wallet address..." style={{ ...input, flex: 2 } as any} spellCheck={false} />
                  <input value={bundlerLabel} onChange={e => setBundlerLabel(e.target.value)} placeholder="Label" style={{ ...input, flex: 1 } as any} />
                  <button onClick={() => {
                    const addr = bundlerInput.trim();
                    if (!addr || addr.length < 32 || bundlers.find(b => b.address === addr)) return;
                    const newB = [...bundlers, { address: addr, label: bundlerLabel.trim() || addr.slice(0, 8), emoji: "🚩", group: "custom", addedAt: Date.now(), seenIn: [] as string[] }];
                    setBundlers(newB); localStorage.setItem("holdtech-bundlers", JSON.stringify(newB));
                    setBundlerInput(""); setBundlerLabel("");
                  }} style={btn}>ADD</button>
                </div>
                <div style={{ display: "flex", gap: "8px", marginBottom: "10px" }}>
                  <button onClick={loadDefaults} style={btnOut}>Load Default Ruggers ({bundlers.length > 0 ? "merge" : "42"})</button>
                  <button onClick={() => { navigator.clipboard.writeText(JSON.stringify(bundlers.map(b => ({ address: b.address, label: b.label, emoji: b.emoji, group: b.group })), null, 2)); }} style={btnOut}>Export JSON</button>
                </div>
                <textarea id="import-json" placeholder='Paste JSON array or wallet addresses...' style={{ ...input, minHeight: "50px", resize: "vertical", fontSize: "10px" } as any} spellCheck={false} />
                <button onClick={() => {
                  const el = document.getElementById("import-json") as HTMLTextAreaElement;
                  if (!el?.value.trim()) return;
                  const existing = new Set(bundlers.map(b => b.address));
                  let newOnes: any[] = [];
                  try {
                    const parsed = JSON.parse(el.value);
                    if (Array.isArray(parsed)) {
                      newOnes = parsed.filter((d: any) => !existing.has(d.trackedWalletAddress || d.address)).map((d: any) => ({ address: d.trackedWalletAddress || d.address, label: d.name || d.label || (d.trackedWalletAddress || d.address).slice(0, 8), emoji: d.emoji || "🚩", group: d.groups?.[0] || d.group || "imported", addedAt: Date.now(), seenIn: [] as string[] }));
                    }
                  } catch { newOnes = el.value.split(/[\n,]+/).map(s => s.trim()).filter(s => s.length >= 32 && !existing.has(s)).map(a => ({ address: a, label: a.slice(0, 8), emoji: "🚩", group: "imported", addedAt: Date.now(), seenIn: [] as string[] })); }
                  if (newOnes.length) { const newB = [...bundlers, ...newOnes]; setBundlers(newB); localStorage.setItem("holdtech-bundlers", JSON.stringify(newB)); el.value = ""; }
                }} style={{ ...btn, marginTop: "6px", fontSize: "10px" } as any}>IMPORT</button>
                <div style={{ maxHeight: "180px", overflow: "auto", marginTop: "12px", borderTop: "1px solid var(--border, rgba(0,0,0,0.04))", paddingTop: "8px" }}>
                  {bundlers.map((b, i) => (
                    <div key={b.address} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "4px 0", fontSize: "11px" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                        <span>{b.emoji || "🚩"}</span>
                        <span style={{ fontWeight: 600 }}>{b.label}</span>
                        <span style={{ ...mono, fontSize: "9px", color: "var(--text-muted, #aaa)" }}>{b.address.slice(0, 6)}..{b.address.slice(-4)}</span>
                        {b.group && <span style={{ fontSize: "8px", color: "#9945FF", background: "rgba(153,69,255,0.06)", padding: "1px 4px", borderRadius: "3px" }}>{b.group}</span>}
                      </div>
                      <button onClick={() => { const newB = bundlers.filter(x => x.address !== b.address); setBundlers(newB); localStorage.setItem("holdtech-bundlers", JSON.stringify(newB)); }} style={{ background: "none", border: "none", cursor: "pointer", color: "#ccc", fontSize: "14px" }}>×</button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Empty */}
            {bundlers.length === 0 && (
              <div style={{ ...card, textAlign: "center", padding: "48px" }}>
                <div style={{ fontSize: "32px", marginBottom: "12px", opacity: 0.5 }}>🔩</div>
                <div style={{ fontSize: "14px", fontWeight: 600, marginBottom: "6px" }}>No bundler wallets tracked</div>
                <div style={{ fontSize: "12px", color: "var(--text-muted, #888)", marginBottom: "16px" }}>Load the default rugger list or add your own.</div>
                <button onClick={loadDefaults} style={btn}>Load Default Ruggers (42 wallets)</button>
              </div>
            )}

            {/* Loading */}
            {feedLoading && feedEvents.length === 0 && <div style={{ textAlign: "center", padding: "32px", color: "var(--text-muted, #888)", fontSize: "13px" }}><div style={{ display: "inline-block", width: 24, height: 24, border: "2px solid rgba(153,69,255,0.15)", borderTopColor: "#9945FF", borderRadius: "50%", animation: "spin 1s linear infinite", marginBottom: "8px" }} /><br/>Loading transactions...</div>}

            {/* Feed */}
            {feedEvents.length > 0 && feedEvents.map((ev, i) => (
              <div key={`${ev.signature}-${i}`} style={{ ...card, display: "flex", alignItems: "center", gap: "12px", padding: "10px 16px" }}>
                <div style={{ width: 40, height: 40, borderRadius: "10px", overflow: "hidden", flexShrink: 0, background: "rgba(153,69,255,0.04)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  {ev.tokenImage ? <img src={ev.tokenImage} alt="" width={40} height={40} style={{ objectFit: "cover" }} onError={e => { (e.target as HTMLImageElement).style.display = "none"; }} /> : <span style={{ fontSize: "18px", opacity: 0.3 }}>🪙</span>}
                </div>
                <div style={{ ...mono, fontSize: "9px", fontWeight: 800, color: ev.type === "buy" ? "#14F195" : "#ef4444", background: ev.type === "buy" ? "rgba(20,241,149,0.1)" : "rgba(239,68,68,0.08)", padding: "4px 8px", borderRadius: "6px", minWidth: "34px", textAlign: "center" }}>{ev.type === "buy" ? "BUY" : "SELL"}</div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                    <span style={{ fontSize: "14px", fontWeight: 700 }}>${ev.tokenSymbol}</span>
                    {ev.solAmount > 0 && <span style={{ ...mono, fontSize: "11px", color: "var(--text-muted, #888)" }}>{ev.solAmount.toFixed(2)} SOL</span>}
                  </div>
                  <div style={{ ...mono, fontSize: "9px", color: "var(--text-muted, #aaa)" }}>{ev.tokenMint.slice(0, 8)}...{ev.tokenMint.slice(-4)}</div>
                </div>
                <div style={{ textAlign: "right", flexShrink: 0 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "4px", justifyContent: "flex-end" }}>
                    <span>{ev.walletEmoji}</span>
                    <span style={{ fontSize: "11px", fontWeight: 600 }}>{ev.walletName}</span>
                  </div>
                  <div style={{ fontSize: "9px", color: "var(--text-muted, #aaa)" }}>{new Date(ev.timestamp).toLocaleString(undefined, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}</div>
                </div>
                <a href={`https://solscan.io/tx/${ev.signature}`} target="_blank" rel="noopener" style={{ color: "#9945FF", textDecoration: "none", fontSize: "11px", flexShrink: 0 }}>↗</a>
              </div>
            ))}
          </div>
        )}

        {/* ═══ FOOTER ═══ */}
        <div style={{ padding: "24px 0", display: "flex", alignItems: "center", justifyContent: "space-between", borderTop: "1px solid var(--border, rgba(153,69,255,0.06))", marginTop: "24px", fontSize: "11px", color: "var(--text-muted, #888)" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
            <a href="/" style={{ display: "flex", alignItems: "center", gap: "6px", fontWeight: 700, color: "var(--accent, #9945FF)", textDecoration: "none" }}>
              <img src="/logo.png" alt="" width={16} height={16} style={{ objectFit: "contain" }} /> HOLDTECH
            </a>
            <a href="https://github.com/co-numina/holdtech" target="_blank" rel="noopener" style={{ color: "inherit", textDecoration: "none" }}>github</a>
            <a href="https://x.com/co_numina" target="_blank" rel="noopener" style={{ color: "inherit", textDecoration: "none" }}>twitter</a>
          </div>
          <span style={{ ...mono, fontSize: "10px" }}>know before you ape</span>
        </div>
      </div>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
