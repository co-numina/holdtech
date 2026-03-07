"use client";
import { useState, useEffect } from "react";
import Link from "next/link";

interface Trade {
  mint: string;
  name: string;
  symbol: string;
  image: string | null;
  buyAmountSol: number;
  sellAmountSol: number;
  profitSol: number;
  profitPct: number;
  closed: boolean;
  timestamp: number;
}

interface PnLResult {
  trades: Trade[];
  totalPnlSol: number;
  winRate: number;
  wins: number;
  losses: number;
  totalTrades: number;
  avgProfitPct: number;
  bestTrade: Trade | null;
  worstTrade: Trade | null;
  isSmartMoney: boolean;
}

export default function SmartMoneyPage() {
  const [wallet, setWallet] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<PnLResult | null>(null);
  const [smartWallets, setSmartWallets] = useState<string[]>([]);

  useEffect(() => {
    fetch("/api/wallet-pnl").then(r => r.json()).then(d => setSmartWallets(d.wallets || [])).catch(() => {});
  }, []);

  const analyze = async (addr?: string) => {
    const target = addr || wallet;
    if (!target || target.length < 30) { setError("Enter a valid wallet address"); return; }
    setLoading(true);
    setError("");
    setResult(null);
    setWallet(target);
    try {
      const res = await fetch("/api/wallet-pnl", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ wallet: target }),
      });
      if (!res.ok) throw new Error("Analysis failed");
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setResult(data);
    } catch (e: any) {
      setError(e.message || "Failed");
    } finally {
      setLoading(false);
    }
  };

  const fmtSol = (n: number) => {
    if (Math.abs(n) >= 1000) return `${(n / 1000).toFixed(1)}K`;
    if (Math.abs(n) >= 100) return n.toFixed(1);
    return n.toFixed(3);
  };

  return (
    <div style={{ minHeight: "100vh", background: "var(--bg)", color: "var(--text)" }}>
      <div style={{ maxWidth: "960px", margin: "0 auto", padding: "40px 20px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "8px" }}>
          <Link href="/" style={{ color: "var(--text-muted)", textDecoration: "none", fontSize: "14px" }}>← Back</Link>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "14px", marginBottom: "8px" }}>
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2L2 7l10 5 10-5-10-5z"/><path d="M2 17l10 5 10-5"/><path d="M2 12l10 5 10-5"/></svg>
          <h1 style={{ fontSize: "28px", fontWeight: 900, margin: 0 }}>Smart Money</h1>
        </div>
        <p style={{ color: "var(--text-muted)", fontSize: "14px", margin: "0 0 32px 0" }}>
          Track wallet performance across pump.fun trades. Win rate, P&L, trade history.
        </p>

        {/* Tracked wallets */}
        {smartWallets.length > 0 && !result && (
          <div className="glass" style={{ borderRadius: "16px", padding: "20px 24px", marginBottom: "24px" }}>
            <div className="font-mono" style={{ fontSize: "10px", color: "var(--text-muted)", letterSpacing: "1px", fontWeight: 600, marginBottom: "12px" }}>
              TRACKED SMART MONEY — {smartWallets.length} WALLETS
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
              {smartWallets.map((w, i) => (
                <button key={i} onClick={() => analyze(w)} style={{
                  display: "flex", alignItems: "center", gap: "10px",
                  padding: "8px 12px", borderRadius: "8px",
                  background: "var(--bg-card-alt)", border: "1px solid var(--border)",
                  color: "var(--text)", cursor: "pointer", width: "100%", textAlign: "left",
                }}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2L2 7l10 5 10-5-10-5z"/><path d="M2 17l10 5 10-5"/><path d="M2 12l10 5 10-5"/></svg>
                  <span className="font-mono" style={{ fontSize: "12px", color: "var(--text-muted)" }}>{w.slice(0, 6)}...{w.slice(-4)}</span>
                  <span className="font-mono" style={{ fontSize: "10px", color: "var(--accent)", marginLeft: "auto" }}>ANALYZE →</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Input */}
        <div className="glass" style={{ borderRadius: "16px", padding: "20px 24px", marginBottom: "24px" }}>
          <div style={{ display: "flex", gap: "10px" }}>
            <input
              value={wallet}
              onChange={e => setWallet(e.target.value.trim())}
              onKeyDown={e => e.key === "Enter" && analyze()}
              placeholder="Wallet address..."
              className="font-mono"
              style={{
                flex: 1, padding: "12px 16px", borderRadius: "10px",
                border: "1px solid var(--border)", background: "var(--bg-card-alt)",
                color: "var(--text)", fontSize: "13px", outline: "none",
              }}
            />
            <button onClick={() => analyze()} disabled={loading} style={{
              padding: "12px 28px", borderRadius: "10px", border: "none",
              background: loading ? "var(--bg-card-alt)" : "linear-gradient(135deg, var(--accent), var(--accent-dark))",
              color: "white", cursor: loading ? "not-allowed" : "pointer",
              fontSize: "13px", fontWeight: 700,
            }}>
              {loading ? "Scanning..." : "Analyze"}
            </button>
          </div>
          {error && <div style={{ marginTop: "10px", fontSize: "12px", color: "var(--red)" }}>{error}</div>}
        </div>

        {/* Loading */}
        {loading && (
          <div style={{ textAlign: "center", padding: "60px 0" }}>
            <div style={{ width: "40px", height: "40px", border: "3px solid var(--border)", borderTop: "3px solid var(--accent)", borderRadius: "50%", animation: "spin 0.8s linear infinite", margin: "0 auto 16px" }} />
            <div style={{ color: "var(--text-muted)", fontSize: "13px" }}>Scanning pump.fun trade history...</div>
          </div>
        )}

        {/* Results */}
        {result && (
          <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
            {/* Header card */}
            <div className="glass" style={{ borderRadius: "16px", overflow: "hidden" }}>
              <div style={{ padding: "16px 24px", background: "linear-gradient(135deg, var(--accent-dark), var(--accent))", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2L2 7l10 5 10-5-10-5z"/><path d="M2 17l10 5 10-5"/><path d="M2 12l10 5 10-5"/></svg>
                  <span style={{ fontSize: "15px", fontWeight: 700, color: "white" }}>WALLET P&L</span>
                  {result.isSmartMoney && (
                    <span style={{ fontSize: "9px", fontWeight: 700, padding: "3px 8px", borderRadius: "5px", background: "rgba(20,241,149,0.15)", color: "#14F195" }}>SMART MONEY</span>
                  )}
                </div>
                <span className="font-mono" style={{ fontSize: "10px", color: "rgba(255,255,255,0.6)" }}>
                  {wallet.slice(0, 6)}...{wallet.slice(-4)}
                </span>
              </div>

              {/* Stats */}
              <div style={{ padding: "20px 24px" }}>
                <div style={{ display: "flex", gap: "12px", marginBottom: "20px" }}>
                  <div style={{ flex: 1, padding: "14px", borderRadius: "12px", background: "var(--bg-card-alt)", border: "1px solid var(--border)", textAlign: "center" }}>
                    <div className="font-mono" style={{ fontSize: "28px", fontWeight: 900, color: result.totalPnlSol >= 0 ? "var(--green)" : "var(--red)" }}>
                      {result.totalPnlSol >= 0 ? "+" : ""}{fmtSol(result.totalPnlSol)}
                    </div>
                    <div style={{ fontSize: "10px", color: "var(--text-muted)", fontWeight: 600, letterSpacing: "1px", marginTop: "4px" }}>TOTAL P&L (SOL)</div>
                  </div>
                  <div style={{ flex: 1, padding: "14px", borderRadius: "12px", background: "var(--bg-card-alt)", border: "1px solid var(--border)", textAlign: "center" }}>
                    <div className="font-mono" style={{ fontSize: "28px", fontWeight: 900, color: result.winRate >= 60 ? "var(--green)" : result.winRate >= 40 ? "#eab308" : "var(--red)" }}>
                      {result.winRate}%
                    </div>
                    <div style={{ fontSize: "10px", color: "var(--text-muted)", fontWeight: 600, letterSpacing: "1px", marginTop: "4px" }}>WIN RATE</div>
                  </div>
                  <div style={{ flex: 1, padding: "14px", borderRadius: "12px", background: "var(--bg-card-alt)", border: "1px solid var(--border)", textAlign: "center" }}>
                    <div className="font-mono" style={{ fontSize: "28px", fontWeight: 900, color: "var(--text)" }}>
                      {result.totalTrades}
                    </div>
                    <div style={{ fontSize: "10px", color: "var(--text-muted)", fontWeight: 600, letterSpacing: "1px", marginTop: "4px" }}>CLOSED TRADES</div>
                  </div>
                  <div style={{ flex: 1, padding: "14px", borderRadius: "12px", background: "var(--bg-card-alt)", border: "1px solid var(--border)", textAlign: "center" }}>
                    <div className="font-mono" style={{ fontSize: "22px", fontWeight: 900, color: "var(--green)" }}>
                      {result.wins}
                    </div>
                    <div className="font-mono" style={{ fontSize: "22px", fontWeight: 900, color: "var(--red)", display: "inline" }}>
                      &nbsp;/&nbsp;{result.losses}
                    </div>
                    <div style={{ fontSize: "10px", color: "var(--text-muted)", fontWeight: 600, letterSpacing: "1px", marginTop: "4px" }}>W / L</div>
                  </div>
                </div>

                {/* Best / Worst */}
                <div style={{ display: "flex", gap: "12px", marginBottom: "20px" }}>
                  {result.bestTrade && (
                    <div style={{ flex: 1, padding: "12px 16px", borderRadius: "12px", background: "rgba(20,241,149,0.04)", border: "1px solid rgba(20,241,149,0.12)" }}>
                      <div className="font-mono" style={{ fontSize: "10px", color: "var(--text-muted)", fontWeight: 600, letterSpacing: "1px" }}>BEST TRADE</div>
                      <div style={{ display: "flex", alignItems: "center", gap: "8px", marginTop: "6px" }}>
                        {result.bestTrade.image && <img src={result.bestTrade.image} width={20} height={20} style={{ borderRadius: "50%" }} alt="" />}
                        <span className="font-mono" style={{ fontSize: "13px", fontWeight: 800 }}>${result.bestTrade.symbol}</span>
                        <span className="font-mono" style={{ fontSize: "13px", fontWeight: 800, color: "var(--green)", marginLeft: "auto" }}>
                          +{fmtSol(result.bestTrade.profitSol)} SOL ({result.bestTrade.profitPct > 0 ? "+" : ""}{result.bestTrade.profitPct}%)
                        </span>
                      </div>
                    </div>
                  )}
                  {result.worstTrade && result.worstTrade.profitSol < 0 && (
                    <div style={{ flex: 1, padding: "12px 16px", borderRadius: "12px", background: "rgba(239,68,68,0.04)", border: "1px solid rgba(239,68,68,0.12)" }}>
                      <div className="font-mono" style={{ fontSize: "10px", color: "var(--text-muted)", fontWeight: 600, letterSpacing: "1px" }}>WORST TRADE</div>
                      <div style={{ display: "flex", alignItems: "center", gap: "8px", marginTop: "6px" }}>
                        {result.worstTrade.image && <img src={result.worstTrade.image} width={20} height={20} style={{ borderRadius: "50%" }} alt="" />}
                        <span className="font-mono" style={{ fontSize: "13px", fontWeight: 800 }}>${result.worstTrade.symbol}</span>
                        <span className="font-mono" style={{ fontSize: "13px", fontWeight: 800, color: "var(--red)", marginLeft: "auto" }}>
                          {fmtSol(result.worstTrade.profitSol)} SOL ({result.worstTrade.profitPct}%)
                        </span>
                      </div>
                    </div>
                  )}
                </div>

                {/* Trade list */}
                <div className="font-mono" style={{ fontSize: "10px", color: "var(--text-muted)", letterSpacing: "1px", fontWeight: 600, marginBottom: "8px" }}>
                  TRADE HISTORY ({result.trades.length} tokens)
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: "4px", maxHeight: "500px", overflowY: "auto" }}>
                  {result.trades.map((trade, i) => (
                    <div key={i} style={{
                      display: "flex", alignItems: "center", gap: "10px",
                      padding: "8px 12px", borderRadius: "8px",
                      background: "var(--bg-card-alt)", border: "1px solid var(--border)",
                    }}>
                      {trade.image ? (
                        <img src={trade.image} width={24} height={24} style={{ borderRadius: "50%", objectFit: "cover" }} alt="" />
                      ) : (
                        <div style={{ width: 24, height: 24, borderRadius: "50%", background: "var(--bg-card)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "10px", fontWeight: 800, color: "var(--text-muted)" }}>
                          {trade.symbol.charAt(0)}
                        </div>
                      )}
                      <div style={{ minWidth: "80px" }}>
                        <span className="font-mono" style={{ fontSize: "12px", fontWeight: 800 }}>${trade.symbol}</span>
                      </div>
                      <div className="font-mono" style={{ fontSize: "10px", color: "var(--text-muted)", minWidth: "70px" }}>
                        Buy: {fmtSol(trade.buyAmountSol)}◎
                      </div>
                      <div className="font-mono" style={{ fontSize: "10px", color: "var(--text-muted)", minWidth: "70px" }}>
                        Sell: {trade.closed ? `${fmtSol(trade.sellAmountSol)}◎` : "—"}
                      </div>
                      <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: "8px" }}>
                        {trade.closed ? (
                          <>
                            <span className="font-mono" style={{ fontSize: "11px", fontWeight: 800, color: trade.profitSol >= 0 ? "var(--green)" : "var(--red)" }}>
                              {trade.profitSol >= 0 ? "+" : ""}{fmtSol(trade.profitSol)}◎
                            </span>
                            <span className="font-mono" style={{
                              fontSize: "9px", fontWeight: 700, padding: "2px 6px", borderRadius: "4px",
                              background: trade.profitSol >= 0 ? "rgba(20,241,149,0.08)" : "rgba(239,68,68,0.08)",
                              color: trade.profitSol >= 0 ? "var(--green)" : "var(--red)",
                            }}>
                              {trade.profitPct >= 0 ? "+" : ""}{trade.profitPct}%
                            </span>
                          </>
                        ) : (
                          <span style={{ fontSize: "9px", fontWeight: 700, padding: "2px 6px", borderRadius: "4px", background: "rgba(153,69,255,0.08)", color: "var(--accent)" }}>HOLDING</span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      <style jsx>{`
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
}
