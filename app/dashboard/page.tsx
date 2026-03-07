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
  mint: string;
  symbol: string;
  score: number;
  grade: string;
  holders: number;
  top5Pct: number;
  freshPct: number;
  avgAge: number;
  timestamp: number;
}

interface WatchlistItem {
  mint: string;
  symbol: string;
  lastScore: number;
  lastGrade: string;
  lastHolders: number;
  addedAt: number;
  history: { score: number; timestamp: number }[];
}

function getTier(balance: number) {
  let tier = TIERS[0];
  for (const t of TIERS) {
    if (balance >= t.min) tier = t;
  }
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

interface FeedEvent {
  wallet: string; walletName: string; walletEmoji: string; walletGroup: string;
  type: "buy" | "sell" | "transfer"; tokenMint: string; tokenSymbol: string;
  tokenImage: string; amount: number; solAmount: number; signature: string; timestamp: number;
}

function BundlerPanel({ bundlers, setBundlers, bundlerInput, setBundlerInput, bundlerLabel, setBundlerLabel, S }: any) {
  const [feedEvents, setFeedEvents] = useState<FeedEvent[]>([]);
  const [feedLoading, setFeedLoading] = useState(false);
  const [feedError, setFeedError] = useState("");
  const [showManage, setShowManage] = useState(false);
  const [autoRefresh, setAutoRefresh] = useState(false);
  const intervalRef = useRef<any>(null);

  const fetchFeed = useCallback(async () => {
    if (bundlers.length === 0) return;
    setFeedLoading(true);
    setFeedError("");
    try {
      // Fetch in batches of 10
      const allEvents: FeedEvent[] = [];
      for (let i = 0; i < bundlers.length; i += 10) {
        const batch = bundlers.slice(i, i + 10).map((b: any) => ({
          address: b.address, name: b.label || b.address.slice(0, 8),
          emoji: b.emoji || "🚩", group: b.group || "tracked",
        }));
        const res = await fetch("/api/bundler-feed", {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ wallets: batch }),
        });
        if (res.ok) {
          const data = await res.json();
          allEvents.push(...(data.events || []));
        }
      }
      allEvents.sort((a, b) => b.timestamp - a.timestamp);
      setFeedEvents(allEvents.slice(0, 200));
    } catch (e: any) {
      setFeedError(e.message || "Failed to fetch");
    }
    setFeedLoading(false);
  }, [bundlers]);

  useEffect(() => {
    if (bundlers.length > 0 && feedEvents.length === 0) fetchFeed();
  }, [bundlers.length]);

  useEffect(() => {
    if (autoRefresh) {
      intervalRef.current = setInterval(fetchFeed, 30000);
      return () => clearInterval(intervalRef.current);
    } else {
      if (intervalRef.current) clearInterval(intervalRef.current);
    }
  }, [autoRefresh, fetchFeed]);

  const loadDefaults = async () => {
    try {
      const res = await fetch("/bundlers-default.json");
      const data = await res.json();
      const existing = new Set(bundlers.map((b: any) => b.address));
      const newOnes = data.filter((d: any) => !existing.has(d.address)).map((d: any) => ({
        address: d.address, label: d.name, emoji: d.emoji, group: d.group,
        addedAt: Date.now(), seenIn: [],
      }));
      const newB = [...bundlers, ...newOnes];
      setBundlers(newB);
      localStorage.setItem("holdtech-bundlers", JSON.stringify(newB));
    } catch {}
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
      {/* Header bar */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          <span style={{ fontSize: "16px" }}>🔩</span>
          <span style={{ ...S.mono, fontSize: "13px", fontWeight: 700, color: "#1a1a2e" }}>BUNDLER FEED</span>
          <span style={{ fontSize: "11px", color: "#888" }}>{bundlers.length} wallets tracked</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <button onClick={() => setAutoRefresh(!autoRefresh)} style={{ ...S.btnOutline, fontSize: "9px", color: autoRefresh ? "#14F195" : "#888", borderColor: autoRefresh ? "rgba(20,241,149,0.3)" : "rgba(0,0,0,0.1)" }}>
            {autoRefresh ? "● LIVE" : "○ AUTO"}
          </button>
          <button onClick={fetchFeed} disabled={feedLoading} style={{ ...S.btnOutline, fontSize: "9px", opacity: feedLoading ? 0.5 : 1 }}>
            {feedLoading ? "Loading..." : "Refresh"}
          </button>
          <button onClick={() => setShowManage(!showManage)} style={{ ...S.btnOutline, fontSize: "9px" }}>
            {showManage ? "Hide" : "Manage"} Wallets
          </button>
        </div>
      </div>

      {/* Manage panel (collapsible) */}
      {showManage && (
        <div style={S.card}>
          <div style={{ display: "flex", gap: "8px", marginBottom: "10px" }}>
            <input value={bundlerInput} onChange={(e: any) => setBundlerInput(e.target.value)} placeholder="Wallet address..." style={{ ...S.input, flex: 2 }} spellCheck={false} />
            <input value={bundlerLabel} onChange={(e: any) => setBundlerLabel(e.target.value)} placeholder="Label" style={{ ...S.input, flex: 1 }} />
            <button onClick={() => {
              const addr = bundlerInput.trim();
              if (!addr || addr.length < 32 || bundlers.find((b: any) => b.address === addr)) return;
              const newB = [...bundlers, { address: addr, label: bundlerLabel.trim() || addr.slice(0, 8), emoji: "🚩", group: "custom", addedAt: Date.now(), seenIn: [] }];
              setBundlers(newB);
              localStorage.setItem("holdtech-bundlers", JSON.stringify(newB));
              setBundlerInput(""); setBundlerLabel("");
            }} style={S.btn}>ADD</button>
          </div>

          <div style={{ display: "flex", gap: "8px", marginBottom: "12px" }}>
            <button onClick={loadDefaults} style={{ ...S.btnOutline, fontSize: "10px" }}>Load Default Rugger List ({bundlers.length > 0 ? "merge" : "42 wallets"})</button>
            <button onClick={() => {
              const json = JSON.stringify(bundlers.map((b: any) => ({ address: b.address, label: b.label, emoji: b.emoji, group: b.group })), null, 2);
              navigator.clipboard.writeText(json);
            }} style={{ ...S.btnOutline, fontSize: "10px" }}>Export JSON</button>
          </div>

          {/* Import JSON */}
          <div style={{ marginBottom: "10px" }}>
            <textarea id="import-json" placeholder='Paste JSON array or wallet addresses (one per line)...' style={{ ...S.input, minHeight: "60px", resize: "vertical", fontSize: "10px" }} spellCheck={false} />
            <button onClick={() => {
              const el = document.getElementById("import-json") as HTMLTextAreaElement;
              if (!el || !el.value.trim()) return;
              const existing = new Set(bundlers.map((b: any) => b.address));
              let newOnes: any[] = [];
              try {
                const parsed = JSON.parse(el.value);
                if (Array.isArray(parsed)) {
                  newOnes = parsed.filter((d: any) => {
                    const addr = d.trackedWalletAddress || d.address;
                    return addr && !existing.has(addr);
                  }).map((d: any) => ({
                    address: d.trackedWalletAddress || d.address,
                    label: d.name || d.label || (d.trackedWalletAddress || d.address).slice(0, 8),
                    emoji: d.emoji || "🚩",
                    group: d.groups?.[0] || d.group || "imported",
                    addedAt: Date.now(), seenIn: [],
                  }));
                }
              } catch {
                // Try as plain addresses
                const lines = el.value.split(/[\n,]+/).map((s: string) => s.trim()).filter((s: string) => s.length >= 32);
                newOnes = lines.filter((a: string) => !existing.has(a)).map((a: string) => ({
                  address: a, label: a.slice(0, 8), emoji: "🚩", group: "imported", addedAt: Date.now(), seenIn: [],
                }));
              }
              if (newOnes.length > 0) {
                const newB = [...bundlers, ...newOnes];
                setBundlers(newB);
                localStorage.setItem("holdtech-bundlers", JSON.stringify(newB));
                el.value = "";
              }
            }} style={{ ...S.btn, marginTop: "6px", fontSize: "10px" }}>IMPORT</button>
          </div>

          {/* Wallet list */}
          <div style={{ maxHeight: "200px", overflow: "auto" }}>
            {bundlers.map((b: any, i: number) => (
              <div key={b.address} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "6px 0", borderTop: i > 0 ? "1px solid rgba(0,0,0,0.04)" : "none", fontSize: "11px" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                  <span>{b.emoji || "🚩"}</span>
                  <span style={{ fontWeight: 600, color: "#1a1a2e" }}>{b.label}</span>
                  <span style={{ ...S.mono, fontSize: "9px", color: "#aaa" }}>{b.address.slice(0, 8)}...{b.address.slice(-4)}</span>
                  <span style={{ fontSize: "8px", color: "#9945FF", background: "rgba(153,69,255,0.06)", padding: "1px 4px", borderRadius: "3px" }}>{b.group}</span>
                </div>
                <button onClick={() => {
                  const newB = bundlers.filter((x: any) => x.address !== b.address);
                  setBundlers(newB);
                  localStorage.setItem("holdtech-bundlers", JSON.stringify(newB));
                }} style={{ background: "none", border: "none", cursor: "pointer", color: "#ccc", fontSize: "14px" }}>×</button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Empty state */}
      {bundlers.length === 0 && (
        <div style={{ ...S.card, textAlign: "center", padding: "48px" }}>
          <div style={{ fontSize: "32px", marginBottom: "12px", opacity: 0.5 }}>🔩</div>
          <div style={{ fontSize: "14px", fontWeight: 600, color: "#1a1a2e", marginBottom: "6px" }}>No bundler wallets tracked</div>
          <div style={{ fontSize: "12px", color: "#888", marginBottom: "16px" }}>Load the default rugger list or add your own wallets to start tracking.</div>
          <button onClick={loadDefaults} style={S.btn}>Load Default Rugger List (42 wallets)</button>
        </div>
      )}

      {/* Feed */}
      {feedError && <div style={{ fontSize: "12px", color: "#ef4444", textAlign: "center" }}>❌ {feedError}</div>}

      {feedLoading && feedEvents.length === 0 && (
        <div style={{ textAlign: "center", padding: "32px", color: "#888", fontSize: "13px" }}>
          <div style={{ display: "inline-block", width: 20, height: 20, border: "2px solid rgba(153,69,255,0.2)", borderTopColor: "#9945FF", borderRadius: "50%", animation: "spin 1s linear infinite", marginBottom: "8px" }} /><br/>
          Loading transactions...
        </div>
      )}

      {feedEvents.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
          {feedEvents.map((ev, i) => (
            <div key={`${ev.signature}-${i}`} style={{ ...S.card, display: "flex", alignItems: "center", gap: "12px", padding: "10px 14px" }}>
              {/* Token image */}
              <div style={{ width: 36, height: 36, borderRadius: "8px", overflow: "hidden", flexShrink: 0, background: "rgba(153,69,255,0.06)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                {ev.tokenImage ? (
                  <img src={ev.tokenImage} alt="" width={36} height={36} style={{ objectFit: "cover" }} onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />
                ) : (
                  <span style={{ fontSize: "16px", opacity: 0.4 }}>🪙</span>
                )}
              </div>

              {/* Buy/Sell indicator */}
              <div style={{ ...S.mono, fontSize: "9px", fontWeight: 800, color: ev.type === "buy" ? "#14F195" : "#ef4444", background: ev.type === "buy" ? "rgba(20,241,149,0.1)" : "rgba(239,68,68,0.1)", padding: "3px 6px", borderRadius: "4px", minWidth: "30px", textAlign: "center" }}>
                {ev.type === "buy" ? "BUY" : "SELL"}
              </div>

              {/* Token info */}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                  <span style={{ fontSize: "13px", fontWeight: 700, color: "#1a1a2e" }}>${ev.tokenSymbol}</span>
                  {ev.solAmount > 0 && <span style={{ ...S.mono, fontSize: "11px", color: "#888" }}>{ev.solAmount.toFixed(2)} SOL</span>}
                </div>
                <div style={{ ...S.mono, fontSize: "9px", color: "#aaa", marginTop: "1px" }}>
                  {ev.tokenMint.slice(0, 8)}...{ev.tokenMint.slice(-4)}
                </div>
              </div>

              {/* Wallet */}
              <div style={{ textAlign: "right", flexShrink: 0 }}>
                <div style={{ display: "flex", alignItems: "center", gap: "4px", justifyContent: "flex-end" }}>
                  <span style={{ fontSize: "12px" }}>{ev.walletEmoji}</span>
                  <span style={{ fontSize: "11px", fontWeight: 600, color: "#1a1a2e" }}>{ev.walletName}</span>
                </div>
                <div style={{ fontSize: "9px", color: "#aaa" }}>
                  {new Date(ev.timestamp).toLocaleString(undefined, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
                </div>
              </div>

              {/* Solscan link */}
              <a href={`https://solscan.io/tx/${ev.signature}`} target="_blank" rel="noopener" style={{ fontSize: "10px", color: "#9945FF", textDecoration: "none", flexShrink: 0 }}>↗</a>
            </div>
          ))}
        </div>
      )}
    </div>
  );
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
  const [progress, setProgress] = useState("");
  const [bundlers, setBundlers] = useState<{ address: string; label: string; emoji?: string; group?: string; addedAt: number; seenIn: string[] }[]>([]);
  const [bundlerInput, setBundlerInput] = useState("");
  const [bundlerLabel, setBundlerLabel] = useState("");
  const historyRef = useRef(history);
  historyRef.current = history;

  // Load persisted data
  useEffect(() => {
    try {
      const h = JSON.parse(localStorage.getItem("holdtech-history") || "[]");
      const w = JSON.parse(localStorage.getItem("holdtech-watchlist") || "[]");
      const b = JSON.parse(localStorage.getItem("holdtech-bundlers") || "[]");
      setHistory(h);
      setWatchlist(w);
      setBundlers(b);
    } catch {}
  }, []);

  // Check token balance
  useEffect(() => {
    if (!connected || !publicKey || !HOLDTECH_MINT) {
      setTokenBalance(HOLDTECH_MINT ? 0 : 999_999_999); // demo mode = whale
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
      const top5 = w.slice(0, 5).reduce((s: number, x: any) => s + (x.balance || 0), 0);
      const wLen = w.length || 1;

      // Compute metrics matching what ai-verdict expects
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
        mint,
        symbol: analysis.tokenSymbol || mint.slice(0, 6),
        score: verdict?.score ?? 0,
        grade: verdict?.grade || "?",
        holders: countData.count || w.length,
        top5Pct: parseFloat(((top5 / supply) * 100).toFixed(1)),
        freshPct: w.length > 0 ? parseFloat(((w.filter((x: any) => x.walletAgeDays !== undefined && x.walletAgeDays < 7).length / w.length) * 100).toFixed(0)) : 0,
        avgAge: w.length > 0 ? Math.round(w.reduce((s: number, x: any) => s + (x.walletAgeDays || 0), 0) / w.length) : 0,
        timestamp: Date.now(),
      };
    } catch { return null; }
  }, []);

  const handleScan = async () => {
    if (!scanInput.trim() || scanning) return;
    setScanning(true);
    setProgress("Analyzing holders...");
    setScanResult(null);
    const result = await runScan(scanInput.trim());
    if (result) {
      setScanResult(result);
      const newHistory = [result, ...historyRef.current.filter(h => h.mint !== result.mint)].slice(0, 50);
      setHistory(newHistory);
      localStorage.setItem("holdtech-history", JSON.stringify(newHistory));
    }
    setScanning(false);
    setProgress("");
  };

  const handleBatch = async () => {
    const mints = batchInput.split(/[\n,]+/).map(s => s.trim()).filter(s => s.length > 30);
    if (!mints.length || batchScanning) return;
    const limit = tier.name === "FREE" ? 2 : tier.name === "SCOUT" ? 5 : tier.name === "OPERATOR" ? 20 : 50;
    const toScan = mints.slice(0, limit);
    setBatchScanning(true);
    setBatchResults([]);
    const results: ScanResult[] = [];
    for (let i = 0; i < toScan.length; i++) {
      setProgress(`Scanning ${i + 1}/${toScan.length}...`);
      const r = await runScan(toScan[i]);
      if (r) { results.push(r); setBatchResults([...results]); }
    }
    setBatchScanning(false);
    setProgress("");
  };

  const addToWatchlist = (result: ScanResult) => {
    if (watchlist.find(w => w.mint === result.mint)) return;
    const limit = tier.name === "FREE" ? 3 : tier.name === "SCOUT" ? 10 : tier.name === "OPERATOR" ? 50 : 200;
    if (watchlist.length >= limit) return;
    const item: WatchlistItem = {
      mint: result.mint, symbol: result.symbol, lastScore: result.score,
      lastGrade: result.grade, lastHolders: result.holders, addedAt: Date.now(),
      history: [{ score: result.score, timestamp: Date.now() }],
    };
    const newWl = [...watchlist, item];
    setWatchlist(newWl);
    localStorage.setItem("holdtech-watchlist", JSON.stringify(newWl));
  };

  const removeFromWatchlist = (mint: string) => {
    const newWl = watchlist.filter(w => w.mint !== mint);
    setWatchlist(newWl);
    localStorage.setItem("holdtech-watchlist", JSON.stringify(newWl));
  };

  // ── STYLES ──
  const S = {
    page: { minHeight: "100vh", background: "#f0f0f6", fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif" } as const,
    container: { maxWidth: "900px", margin: "0 auto", padding: "0 20px" } as const,
    nav: { padding: "14px 0", display: "flex", alignItems: "center", justifyContent: "space-between", borderBottom: "1px solid rgba(153,69,255,0.1)" } as const,
    logo: { fontFamily: "'Courier New', monospace", fontSize: "18px", fontWeight: 800, cursor: "pointer", textDecoration: "none" } as const,
    card: { background: "rgba(255,255,255,0.6)", backdropFilter: "blur(12px)", border: "1px solid rgba(153,69,255,0.1)", borderRadius: "14px", padding: "20px" } as const,
    mono: { fontFamily: "'Courier New', monospace" } as const,
    input: { width: "100%", padding: "12px 14px", border: "1px solid rgba(153,69,255,0.15)", borderRadius: "10px", fontSize: "13px", background: "rgba(255,255,255,0.8)", fontFamily: "'Courier New', monospace", outline: "none", color: "#1a1a2e" } as const,
    btn: { padding: "10px 20px", background: "linear-gradient(135deg, #9945FF, #7B3FE4)", color: "white", border: "none", borderRadius: "10px", fontSize: "12px", fontWeight: 700, cursor: "pointer", fontFamily: "'Courier New', monospace" } as const,
    btnOutline: { padding: "8px 14px", background: "transparent", color: "#9945FF", border: "1px solid rgba(153,69,255,0.25)", borderRadius: "8px", fontSize: "11px", fontWeight: 700, cursor: "pointer", fontFamily: "'Courier New', monospace" } as const,
    tab: (active: boolean) => ({ padding: "8px 16px", background: active ? "rgba(153,69,255,0.1)" : "transparent", color: active ? "#9945FF" : "#888", border: "1px solid " + (active ? "rgba(153,69,255,0.2)" : "transparent"), borderRadius: "8px", fontSize: "11px", fontWeight: 700, cursor: "pointer", fontFamily: "'Courier New', monospace" } as const),
    metricLabel: { fontSize: "9px", color: "#888", textTransform: "uppercase" as const, fontFamily: "'Courier New', monospace", letterSpacing: "0.05em" },
    metricValue: { fontSize: "18px", fontWeight: 700, color: "#1a1a2e", fontFamily: "'Courier New', monospace", marginTop: "2px" },
  };

  // ── GATE ──
  if (!isDemo && !connected) {
    return (
      <div style={S.page}>
        <div style={{ ...S.container, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", minHeight: "100vh", gap: "24px" }}>
          <a href="/" style={{ ...S.logo, background: "linear-gradient(135deg, #9945FF, #14F195)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>HOLDTECH</a>
          <div style={{ textAlign: "center", maxWidth: "400px" }}>
            <div style={{ fontSize: "48px", marginBottom: "16px" }}>🔬</div>
            <div style={{ fontSize: "20px", fontWeight: 700, color: "#1a1a2e", marginBottom: "8px" }}>Dashboard</div>
            <div style={{ fontSize: "13px", color: "#888", marginBottom: "24px", lineHeight: 1.6 }}>
              Connect your wallet to access the HoldTech dashboard. Hold $HOLDTECH to unlock premium features.
            </div>
            <WalletMultiButton style={{ ...S.btn, fontSize: "14px", padding: "14px 28px" }} />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={S.page}>
      {/* NAV */}
      <div style={S.container}>
        <div style={S.nav}>
          <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
            <a href="/" style={{ ...S.logo, background: "linear-gradient(135deg, #9945FF, #14F195)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", textDecoration: "none" }}>HOLDTECH</a>
            <span style={{ ...S.mono, fontSize: "10px", fontWeight: 700, color: tier.color, padding: "3px 8px", borderRadius: "4px", border: `1px solid ${tier.color}33`, background: `${tier.color}0a` }}>{tier.name}{isDemo && " (DEMO)"}</span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
            {!isDemo && <span style={{ fontSize: "11px", color: "#888" }}>{tokenBalance.toLocaleString()} $HOLDTECH</span>}
            {!isDemo ? <WalletMultiButton style={{ ...S.btnOutline, padding: "6px 12px", fontSize: "10px" }} /> :
              <a href="/" style={{ ...S.btnOutline, textDecoration: "none", fontSize: "10px" }}>← Back</a>
            }
          </div>
        </div>

        {/* TABS */}
        <div style={{ display: "flex", gap: "8px", padding: "16px 0" }}>
          {(["scan", "watchlist", "history", "batch", "bundlers"] as const).map(t => (
            <button key={t} onClick={() => setTab(t)} style={S.tab(tab === t)}>{t === "bundlers" ? "🔩 BUNDLERS" : t.toUpperCase()}{t === "watchlist" && ` (${watchlist.length})`}{t === "history" && ` (${history.length})`}{t === "bundlers" && ` (${bundlers.length})`}</button>
          ))}
        </div>

        {/* ── SCAN TAB ── */}
        {tab === "scan" && (
          <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
            <div style={{ display: "flex", gap: "8px" }}>
              <input value={scanInput} onChange={e => setScanInput(e.target.value)} onKeyDown={e => e.key === "Enter" && handleScan()} placeholder="Paste token address..." style={S.input} spellCheck={false} />
              <button onClick={handleScan} disabled={scanning} style={{ ...S.btn, opacity: scanning ? 0.5 : 1 }}>{scanning ? "..." : "SCAN"}</button>
            </div>
            {scanning && <div style={{ textAlign: "center", padding: "24px", color: "#888", fontSize: "13px" }}><div style={{ display: "inline-block", width: 20, height: 20, border: "2px solid rgba(153,69,255,0.2)", borderTopColor: "#9945FF", borderRadius: "50%", animation: "spin 1s linear infinite", marginBottom: "8px" }} /><br/>{progress}</div>}
            {scanResult && (
              <div style={S.card}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "16px" }}>
                  <div>
                    <div style={{ fontSize: "16px", fontWeight: 700, color: "#1a1a2e" }}>{scanResult.symbol}</div>
                    <div style={{ ...S.mono, fontSize: "10px", color: "#888", marginTop: "2px" }}>{scanResult.mint.slice(0, 8)}...{scanResult.mint.slice(-6)}</div>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                    <button onClick={() => addToWatchlist(scanResult)} style={S.btnOutline}>+ Watch</button>
                    <a href={`/?mint=${scanResult.mint}`} target="_blank" style={{ ...S.btnOutline, textDecoration: "none" }}>Full Analysis →</a>
                    <div style={{ ...S.mono, fontSize: "24px", fontWeight: 800, padding: "4px 14px", borderRadius: "8px", background: `${gradeColor(scanResult.grade)}20`, color: gradeColor(scanResult.grade) }}>{scanResult.grade}</div>
                  </div>
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr 1fr", gap: "12px" }}>
                  {[
                    { label: "Score", value: `${scanResult.score}/100` },
                    { label: "Holders", value: scanResult.holders.toLocaleString() },
                    { label: "Top 5", value: `${scanResult.top5Pct}%` },
                    { label: "Fresh", value: `${scanResult.freshPct}%` },
                    { label: "Avg Age", value: `${scanResult.avgAge}d` },
                  ].map(m => (
                    <div key={m.label} style={{ background: "rgba(153,69,255,0.03)", borderRadius: "8px", padding: "10px" }}>
                      <div style={S.metricLabel}>{m.label}</div>
                      <div style={S.metricValue}>{m.value}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── WATCHLIST TAB ── */}
        {tab === "watchlist" && (
          <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
            {watchlist.length === 0 && (
              <div style={{ textAlign: "center", padding: "48px", color: "#aaa", fontSize: "13px" }}>
                <div style={{ fontSize: "32px", marginBottom: "8px", opacity: 0.5 }}>👁️</div>
                No tokens watched yet. Scan a token and click "+ Watch".
              </div>
            )}
            {watchlist.map(w => (
              <div key={w.mint} style={{ ...S.card, display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 20px" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "14px" }}>
                  <div style={{ ...S.mono, fontSize: "20px", fontWeight: 800, color: gradeColor(w.lastGrade), minWidth: "32px" }}>{w.lastGrade}</div>
                  <div>
                    <div style={{ fontSize: "14px", fontWeight: 700, color: "#1a1a2e" }}>{w.symbol}</div>
                    <div style={{ ...S.mono, fontSize: "10px", color: "#888" }}>{w.mint.slice(0, 8)}...{w.mint.slice(-6)}</div>
                  </div>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: "20px" }}>
                  <div style={{ textAlign: "right" }}>
                    <div style={{ ...S.mono, fontSize: "14px", fontWeight: 700, color: "#1a1a2e" }}>{w.lastScore}/100</div>
                    <div style={{ fontSize: "10px", color: "#888" }}>{w.lastHolders.toLocaleString()} holders</div>
                  </div>
                  <div style={{ display: "flex", gap: "6px" }}>
                    <button onClick={() => { setScanInput(w.mint); setTab("scan"); }} style={S.btnOutline}>Rescan</button>
                    <button onClick={() => removeFromWatchlist(w.mint)} style={{ ...S.btnOutline, color: "#ef4444", borderColor: "rgba(239,68,68,0.25)" }}>×</button>
                  </div>
                </div>
              </div>
            ))}
            <div style={{ fontSize: "10px", color: "#888", textAlign: "center", padding: "8px" }}>
              {watchlist.length}/{tier.name === "FREE" ? 3 : tier.name === "SCOUT" ? 10 : tier.name === "OPERATOR" ? 50 : 200} slots used · {tier.name} tier
            </div>
          </div>
        )}

        {/* ── HISTORY TAB ── */}
        {tab === "history" && (
          <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
            {history.length === 0 && (
              <div style={{ textAlign: "center", padding: "48px", color: "#aaa", fontSize: "13px" }}>
                <div style={{ fontSize: "32px", marginBottom: "8px", opacity: 0.5 }}>📜</div>
                No scan history yet.
              </div>
            )}
            {/* Table header */}
            {history.length > 0 && (
              <div style={{ display: "grid", gridTemplateColumns: "40px 1fr 80px 60px 60px 60px 80px", gap: "8px", padding: "8px 16px", fontSize: "9px", color: "#888", ...S.mono, letterSpacing: "0.05em", textTransform: "uppercase" as const }}>
                <span>Grade</span><span>Token</span><span>Score</span><span>Holders</span><span>Top 5</span><span>Fresh</span><span>When</span>
              </div>
            )}
            {history.map((h, i) => (
              <div key={`${h.mint}-${i}`} onClick={() => { setScanInput(h.mint); setTab("scan"); }} style={{ ...S.card, display: "grid", gridTemplateColumns: "40px 1fr 80px 60px 60px 60px 80px", gap: "8px", alignItems: "center", padding: "10px 16px", cursor: "pointer" }}>
                <span style={{ ...S.mono, fontSize: "14px", fontWeight: 800, color: gradeColor(h.grade) }}>{h.grade}</span>
                <div>
                  <div style={{ fontSize: "13px", fontWeight: 600, color: "#1a1a2e" }}>{h.symbol}</div>
                  <div style={{ ...S.mono, fontSize: "9px", color: "#aaa" }}>{h.mint.slice(0, 6)}...{h.mint.slice(-4)}</div>
                </div>
                <span style={{ ...S.mono, fontSize: "13px", fontWeight: 700 }}>{h.score}/100</span>
                <span style={{ ...S.mono, fontSize: "12px", color: "#666" }}>{h.holders.toLocaleString()}</span>
                <span style={{ ...S.mono, fontSize: "12px", color: "#666" }}>{h.top5Pct}%</span>
                <span style={{ ...S.mono, fontSize: "12px", color: h.freshPct > 40 ? "#ef4444" : "#666" }}>{h.freshPct}%</span>
                <span style={{ fontSize: "10px", color: "#aaa" }}>{timeAgo(h.timestamp)}</span>
              </div>
            ))}
            {history.length > 0 && (
              <button onClick={() => { setHistory([]); localStorage.removeItem("holdtech-history"); }} style={{ ...S.btnOutline, alignSelf: "center", marginTop: "8px", color: "#888", borderColor: "rgba(0,0,0,0.1)" }}>Clear History</button>
            )}
          </div>
        )}

        {/* ── BATCH TAB ── */}
        {tab === "batch" && (
          <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
            <div style={S.card}>
              <div style={{ ...S.mono, fontSize: "11px", fontWeight: 700, color: "#1a1a2e", marginBottom: "8px" }}>BATCH SCAN</div>
              <div style={{ fontSize: "11px", color: "#888", marginBottom: "12px" }}>
                Paste multiple token addresses (one per line or comma-separated). Max {tier.name === "FREE" ? 2 : tier.name === "SCOUT" ? 5 : tier.name === "OPERATOR" ? 20 : 50} per batch ({tier.name} tier).
              </div>
              <textarea value={batchInput} onChange={e => setBatchInput(e.target.value)} placeholder={"Paste token addresses...\nOne per line or comma-separated"} style={{ ...S.input, minHeight: "100px", resize: "vertical" }} spellCheck={false} />
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: "12px" }}>
                <span style={{ fontSize: "11px", color: "#888" }}>{batchInput.split(/[\n,]+/).filter(s => s.trim().length > 30).length} tokens detected</span>
                <button onClick={handleBatch} disabled={batchScanning} style={{ ...S.btn, opacity: batchScanning ? 0.5 : 1 }}>{batchScanning ? progress : "SCAN ALL"}</button>
              </div>
            </div>
            {batchResults.length > 0 && (
              <div style={S.card}>
                <div style={{ ...S.mono, fontSize: "11px", fontWeight: 700, color: "#1a1a2e", marginBottom: "12px" }}>RESULTS ({batchResults.length})</div>
                <div style={{ display: "grid", gridTemplateColumns: "44px 1fr 70px 70px 60px 60px", gap: "6px 8px", fontSize: "9px", color: "#888", ...S.mono, letterSpacing: "0.05em", textTransform: "uppercase" as const, marginBottom: "8px", padding: "0 4px" }}>
                  <span>Grade</span><span>Token</span><span>Score</span><span>Holders</span><span>Top 5</span><span>Fresh</span>
                </div>
                {[...batchResults].sort((a, b) => b.score - a.score).map((r, i) => (
                  <div key={r.mint} style={{ display: "grid", gridTemplateColumns: "44px 1fr 70px 70px 60px 60px", gap: "6px 8px", alignItems: "center", padding: "8px 4px", borderTop: i > 0 ? "1px solid rgba(153,69,255,0.06)" : "none" }}>
                    <span style={{ ...S.mono, fontSize: "16px", fontWeight: 800, color: gradeColor(r.grade) }}>{r.grade}</span>
                    <div>
                      <span style={{ fontSize: "13px", fontWeight: 600 }}>{r.symbol}</span>
                      <a href={`/?mint=${r.mint}`} target="_blank" style={{ fontSize: "9px", color: "#9945FF", marginLeft: "6px" }}>→</a>
                    </div>
                    <span style={{ ...S.mono, fontSize: "13px", fontWeight: 700 }}>{r.score}/100</span>
                    <span style={{ ...S.mono, fontSize: "12px", color: "#666" }}>{r.holders.toLocaleString()}</span>
                    <span style={{ ...S.mono, fontSize: "12px", color: "#666" }}>{r.top5Pct}%</span>
                    <span style={{ ...S.mono, fontSize: "12px", color: r.freshPct > 40 ? "#ef4444" : "#666" }}>{r.freshPct}%</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ── BUNDLERS TAB ── */}
        {tab === "bundlers" && <BundlerPanel bundlers={bundlers} setBundlers={setBundlers} bundlerInput={bundlerInput} setBundlerInput={setBundlerInput} bundlerLabel={bundlerLabel} setBundlerLabel={setBundlerLabel} S={S} />}

        {/* FOOTER */}
        <div style={{ padding: "24px 0", textAlign: "center", fontSize: "10px", color: "#aaa", marginTop: "32px", borderTop: "1px solid rgba(153,69,255,0.06)" }}>
          <a href="/" style={{ color: "#9945FF", textDecoration: "none", fontWeight: 600 }}>holdtech.fun</a> · <a href="https://github.com/co-numina/holdtech" target="_blank" style={{ color: "#888", textDecoration: "none" }}>github</a> · <a href="https://x.com/co_numina" target="_blank" style={{ color: "#888", textDecoration: "none" }}>twitter</a>
        </div>
      </div>

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
