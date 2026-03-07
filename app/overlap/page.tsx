"use client";
import { useState } from "react";
import Link from "next/link";

interface OverlapPair {
  tokenA: { mint: string; name: string; symbol: string; image: string | null; holderCount: number };
  tokenB: { mint: string; name: string; symbol: string; image: string | null; holderCount: number };
  sharedWallets: number;
  overlapPctA: number;
  overlapPctB: number;
  overlapScore: number;
  wallets: Array<{ wallet: string; amountA: number; amountB: number }>;
}

interface OverlapResult {
  pairs: OverlapPair[];
  coordination: "NONE" | "LOW" | "MODERATE" | "HIGH" | "CRITICAL";
  maxOverlap: number;
  tokensAnalyzed: number;
}

const coordColors: Record<string, string> = {
  NONE: "var(--green)",
  LOW: "var(--green)",
  MODERATE: "#eab308",
  HIGH: "#f97316",
  CRITICAL: "var(--red)",
};

const coordLabels: Record<string, string> = {
  NONE: "No Coordination Detected",
  LOW: "Low Coordination",
  MODERATE: "Moderate Coordination",
  HIGH: "High Coordination — Likely Same Group",
  CRITICAL: "Critical — Almost Certainly Coordinated",
};

function TokenPill({ token }: { token: OverlapPair["tokenA"] }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
      {token.image ? (
        <img src={token.image} width={24} height={24} style={{ borderRadius: "50%", objectFit: "cover" }} alt="" />
      ) : (
        <div style={{ width: 24, height: 24, borderRadius: "50%", background: "var(--bg-card)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "10px", fontWeight: 800, color: "var(--text-muted)" }}>
          {token.symbol.charAt(0)}
        </div>
      )}
      <div>
        <span className="font-mono" style={{ fontSize: "13px", fontWeight: 800, color: "var(--text)" }}>${token.symbol}</span>
        <span style={{ fontSize: "11px", color: "var(--text-muted)", marginLeft: "6px" }}>{token.holderCount} holders</span>
      </div>
    </div>
  );
}

export default function OverlapPage() {
  const [inputs, setInputs] = useState(["", ""]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<OverlapResult | null>(null);
  const [expandedPair, setExpandedPair] = useState<number | null>(null);

  const addInput = () => {
    if (inputs.length < 5) setInputs([...inputs, ""]);
  };

  const removeInput = (idx: number) => {
    if (inputs.length > 2) setInputs(inputs.filter((_, i) => i !== idx));
  };

  const updateInput = (idx: number, val: string) => {
    const next = [...inputs];
    next[idx] = val.trim();
    setInputs(next);
  };

  const analyze = async () => {
    const mints = inputs.filter(m => m.length > 30);
    if (mints.length < 2) {
      setError("Enter at least 2 token contract addresses");
      return;
    }
    setLoading(true);
    setError("");
    setResult(null);
    setExpandedPair(null);
    try {
      const res = await fetch("/api/holder-overlap", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mints }),
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

  return (
    <div style={{ minHeight: "100vh", background: "var(--bg)", color: "var(--text)" }}>
      {/* Header */}
      <div style={{ maxWidth: "900px", margin: "0 auto", padding: "40px 20px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "8px" }}>
          <Link href="/" style={{ color: "var(--text-muted)", textDecoration: "none", fontSize: "14px" }}>← Back</Link>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "14px", marginBottom: "8px" }}>
          <span style={{ fontSize: "32px" }}>🔗</span>
          <h1 style={{ fontSize: "28px", fontWeight: 900, margin: 0 }}>Holder Overlap</h1>
        </div>
        <p style={{ color: "var(--text-muted)", fontSize: "14px", margin: "0 0 32px 0" }}>
          Compare holder bases across tokens. High overlap = likely coordinated by the same group.
        </p>

        {/* Input section */}
        <div className="glass" style={{ borderRadius: "16px", padding: "24px", marginBottom: "24px" }}>
          <div style={{ display: "flex", flexDirection: "column", gap: "10px", marginBottom: "16px" }}>
            {inputs.map((val, idx) => (
              <div key={idx} style={{ display: "flex", gap: "8px", alignItems: "center" }}>
                <span className="font-mono" style={{ fontSize: "11px", color: "var(--text-muted)", fontWeight: 600, width: "20px" }}>{idx + 1}.</span>
                <input
                  value={val}
                  onChange={e => updateInput(idx, e.target.value)}
                  placeholder="Token contract address..."
                  className="font-mono"
                  style={{
                    flex: 1,
                    padding: "12px 16px",
                    borderRadius: "10px",
                    border: "1px solid var(--border)",
                    background: "var(--bg-card-alt)",
                    color: "var(--text)",
                    fontSize: "13px",
                    outline: "none",
                  }}
                />
                {inputs.length > 2 && (
                  <button onClick={() => removeInput(idx)} style={{ background: "none", border: "none", color: "var(--text-muted)", cursor: "pointer", fontSize: "18px", padding: "4px 8px" }}>×</button>
                )}
              </div>
            ))}
          </div>

          <div style={{ display: "flex", gap: "10px" }}>
            {inputs.length < 5 && (
              <button onClick={addInput} style={{
                padding: "10px 20px", borderRadius: "10px", border: "1px dashed var(--border)",
                background: "transparent", color: "var(--text-muted)", cursor: "pointer", fontSize: "12px", fontWeight: 600,
              }}>
                + Add Token
              </button>
            )}
            <button onClick={analyze} disabled={loading} style={{
              flex: 1, padding: "12px 24px", borderRadius: "10px", border: "none",
              background: loading ? "var(--bg-card-alt)" : "linear-gradient(135deg, var(--accent), var(--accent-dark))",
              color: "white", cursor: loading ? "not-allowed" : "pointer",
              fontSize: "14px", fontWeight: 700, letterSpacing: "0.5px",
            }}>
              {loading ? "Analyzing holders..." : "Compare Holders"}
            </button>
          </div>

          {error && <div style={{ marginTop: "12px", padding: "10px 14px", borderRadius: "8px", background: "rgba(239,68,68,0.08)", color: "var(--red)", fontSize: "12px" }}>{error}</div>}
        </div>

        {/* Loading */}
        {loading && (
          <div style={{ textAlign: "center", padding: "60px 0" }}>
            <div style={{ width: "40px", height: "40px", border: "3px solid var(--border)", borderTop: "3px solid var(--accent)", borderRadius: "50%", animation: "spin 0.8s linear infinite", margin: "0 auto 16px" }} />
            <div style={{ color: "var(--text-muted)", fontSize: "13px" }}>Pulling holder data for {inputs.filter(m => m.length > 30).length} tokens...</div>
          </div>
        )}

        {/* Results */}
        {result && (
          <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
            {/* Coordination verdict */}
            <div className="glass" style={{
              borderRadius: "16px", overflow: "hidden",
              border: `1px solid ${result.coordination === "CRITICAL" || result.coordination === "HIGH" ? "rgba(239,68,68,0.2)" : "var(--border)"}`,
            }}>
              <div style={{ padding: "20px 24px", background: `${coordColors[result.coordination]}08`, borderBottom: `1px solid ${coordColors[result.coordination]}15` }}>
                <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                  <span style={{ fontSize: "24px" }}>
                    {result.coordination === "CRITICAL" ? "🚨" : result.coordination === "HIGH" ? "⚠️" : result.coordination === "MODERATE" ? "🔍" : "✅"}
                  </span>
                  <div>
                    <div style={{ fontSize: "18px", fontWeight: 800, color: coordColors[result.coordination] }}>
                      {result.coordination}
                    </div>
                    <div style={{ fontSize: "13px", color: "var(--text-muted)" }}>{coordLabels[result.coordination]}</div>
                  </div>
                  <div style={{ marginLeft: "auto", textAlign: "right" }}>
                    <div className="font-mono" style={{ fontSize: "32px", fontWeight: 900, color: coordColors[result.coordination] }}>{result.maxOverlap}%</div>
                    <div style={{ fontSize: "10px", color: "var(--text-muted)", fontWeight: 600, letterSpacing: "1px" }}>MAX OVERLAP</div>
                  </div>
                </div>
              </div>
            </div>

            {/* Pair breakdowns */}
            {result.pairs.map((pair, idx) => (
              <div key={idx} className="glass" style={{ borderRadius: "16px", overflow: "hidden" }}>
                <button
                  onClick={() => setExpandedPair(expandedPair === idx ? null : idx)}
                  style={{
                    width: "100%", padding: "18px 24px", background: "transparent", border: "none",
                    cursor: "pointer", display: "flex", alignItems: "center", gap: "16px", color: "var(--text)",
                  }}
                >
                  <TokenPill token={pair.tokenA} />
                  <div style={{ display: "flex", flexDirection: "column", alignItems: "center", flex: "0 0 auto" }}>
                    <span className="font-mono" style={{ fontSize: "20px", fontWeight: 900, color: pair.overlapScore >= 40 ? "var(--red)" : pair.overlapScore >= 20 ? "#eab308" : "var(--green)" }}>
                      {pair.overlapScore}%
                    </span>
                    <span style={{ fontSize: "9px", color: "var(--text-muted)", fontWeight: 600, letterSpacing: "1px" }}>OVERLAP</span>
                  </div>
                  <TokenPill token={pair.tokenB} />
                  <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: "12px" }}>
                    <div style={{ textAlign: "right" }}>
                      <div className="font-mono" style={{ fontSize: "16px", fontWeight: 800 }}>{pair.sharedWallets}</div>
                      <div style={{ fontSize: "9px", color: "var(--text-muted)", fontWeight: 600, letterSpacing: "1px" }}>SHARED</div>
                    </div>
                    <span style={{ color: "var(--text-muted)", fontSize: "14px", transform: expandedPair === idx ? "rotate(180deg)" : "none", transition: "transform 0.2s" }}>▼</span>
                  </div>
                </button>

                {/* Expanded details */}
                {expandedPair === idx && (
                  <div style={{ padding: "0 24px 20px", borderTop: "1px solid var(--border)" }}>
                    {/* Overlap bars */}
                    <div style={{ display: "flex", gap: "16px", margin: "16px 0" }}>
                      <div style={{ flex: 1 }}>
                        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "6px" }}>
                          <span className="font-mono" style={{ fontSize: "10px", color: "var(--text-muted)" }}>${pair.tokenA.symbol} holders in ${pair.tokenB.symbol}</span>
                          <span className="font-mono" style={{ fontSize: "10px", fontWeight: 800 }}>{pair.overlapPctA}%</span>
                        </div>
                        <div style={{ height: "6px", borderRadius: "3px", background: "var(--bg-card-alt)", overflow: "hidden" }}>
                          <div style={{ height: "100%", width: `${pair.overlapPctA}%`, borderRadius: "3px", background: pair.overlapPctA >= 40 ? "var(--red)" : pair.overlapPctA >= 20 ? "#eab308" : "var(--accent)" }} />
                        </div>
                      </div>
                      <div style={{ flex: 1 }}>
                        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "6px" }}>
                          <span className="font-mono" style={{ fontSize: "10px", color: "var(--text-muted)" }}>${pair.tokenB.symbol} holders in ${pair.tokenA.symbol}</span>
                          <span className="font-mono" style={{ fontSize: "10px", fontWeight: 800 }}>{pair.overlapPctB}%</span>
                        </div>
                        <div style={{ height: "6px", borderRadius: "3px", background: "var(--bg-card-alt)", overflow: "hidden" }}>
                          <div style={{ height: "100%", width: `${pair.overlapPctB}%`, borderRadius: "3px", background: pair.overlapPctB >= 40 ? "var(--red)" : pair.overlapPctB >= 20 ? "#eab308" : "var(--accent)" }} />
                        </div>
                      </div>
                    </div>

                    {/* Shared wallets table */}
                    {pair.wallets.length > 0 && (
                      <div>
                        <div className="font-mono" style={{ fontSize: "10px", color: "var(--text-muted)", letterSpacing: "1px", fontWeight: 600, marginBottom: "8px" }}>
                          SHARED WALLETS ({pair.sharedWallets > 50 ? `top 50 of ${pair.sharedWallets}` : pair.sharedWallets})
                        </div>
                        <div style={{ maxHeight: "300px", overflowY: "auto", borderRadius: "10px", border: "1px solid var(--border)" }}>
                          <table style={{ width: "100%", fontSize: "11px", borderCollapse: "collapse" }}>
                            <thead>
                              <tr style={{ background: "var(--bg-card-alt)" }}>
                                <th style={{ padding: "8px 12px", textAlign: "left", fontWeight: 600, color: "var(--text-muted)", fontSize: "10px", letterSpacing: "0.5px" }}>WALLET</th>
                                <th style={{ padding: "8px 12px", textAlign: "right", fontWeight: 600, color: "var(--text-muted)", fontSize: "10px" }}>${pair.tokenA.symbol}</th>
                                <th style={{ padding: "8px 12px", textAlign: "right", fontWeight: 600, color: "var(--text-muted)", fontSize: "10px" }}>${pair.tokenB.symbol}</th>
                              </tr>
                            </thead>
                            <tbody>
                              {pair.wallets.map((w, wi) => (
                                <tr key={wi} style={{ borderTop: "1px solid var(--border)" }}>
                                  <td className="font-mono" style={{ padding: "6px 12px", color: "var(--text-muted)" }}>
                                    {w.wallet.slice(0, 4)}...{w.wallet.slice(-4)}
                                  </td>
                                  <td className="font-mono" style={{ padding: "6px 12px", textAlign: "right" }}>
                                    {w.amountA > 1e9 ? `${(w.amountA / 1e9).toFixed(1)}B` : w.amountA > 1e6 ? `${(w.amountA / 1e6).toFixed(1)}M` : w.amountA > 1e3 ? `${(w.amountA / 1e3).toFixed(1)}K` : w.amountA}
                                  </td>
                                  <td className="font-mono" style={{ padding: "6px 12px", textAlign: "right" }}>
                                    {w.amountB > 1e9 ? `${(w.amountB / 1e9).toFixed(1)}B` : w.amountB > 1e6 ? `${(w.amountB / 1e6).toFixed(1)}M` : w.amountB > 1e3 ? `${(w.amountB / 1e3).toFixed(1)}K` : w.amountB}
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
              </div>
            ))}
          </div>
        )}
      </div>

      <style jsx>{`
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
}
