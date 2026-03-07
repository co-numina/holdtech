import { ImageResponse } from "@vercel/og";
import { NextRequest } from "next/server";

export const runtime = "edge";

function gc(g: string) {
  if (g?.startsWith("A")) return "#14F195";
  if (g?.startsWith("B")) return "#4ade80";
  if (g?.startsWith("C")) return "#eab308";
  if (g?.startsWith("D")) return "#f97316";
  return "#ef4444";
}

// Returns color + tag based on metric meaning
// "inverted" metrics: lower = better (fresh wallets, low activity, single token)
// "normal" metrics: higher = better (veterans, diamond hands)
function metricStatus(label: string, value: number): { color: string; tag: string } {
  if (label === "FRESH WALLETS") {
    if (value <= 10) return { color: "#14F195", tag: "CLEAN" };
    if (value <= 30) return { color: "#4ade80", tag: "OK" };
    if (value <= 50) return { color: "#eab308", tag: "CAUTION" };
    return { color: "#ef4444", tag: "DANGER" };
  }
  if (label === "VETERANS 90D+") {
    if (value >= 50) return { color: "#14F195", tag: "STRONG" };
    if (value >= 25) return { color: "#4ade80", tag: "DECENT" };
    if (value >= 10) return { color: "#eab308", tag: "LOW" };
    return { color: "#ef4444", tag: "ABSENT" };
  }
  if (label === "LOW ACTIVITY") {
    if (value <= 15) return { color: "#14F195", tag: "CLEAN" };
    if (value <= 30) return { color: "#eab308", tag: "SOME" };
    if (value <= 50) return { color: "#f97316", tag: "HIGH" };
    return { color: "#ef4444", tag: "BURNERS" };
  }
  if (label === "SINGLE TOKEN") {
    if (value <= 10) return { color: "#14F195", tag: "CLEAN" };
    if (value <= 25) return { color: "#eab308", tag: "SOME" };
    if (value <= 40) return { color: "#f97316", tag: "HIGH" };
    return { color: "#ef4444", tag: "SYBIL" };
  }
  if (label === "DIAMOND HANDS") {
    if (value >= 60) return { color: "#14F195", tag: "DIAMOND" };
    if (value >= 35) return { color: "#4ade80", tag: "SOLID" };
    if (value >= 15) return { color: "#eab308", tag: "WEAK" };
    return { color: "#ef4444", tag: "PAPER" };
  }
  if (label === "AVG SOL BAL") {
    if (value >= 5) return { color: "#14F195", tag: "FUNDED" };
    if (value >= 1) return { color: "#4ade80", tag: "OK" };
    if (value >= 0.3) return { color: "#eab308", tag: "LIGHT" };
    return { color: "#ef4444", tag: "DUST" };
  }
  return { color: "#888", tag: "" };
}

export async function GET(req: NextRequest) {
  const p = req.nextUrl.searchParams;
  const symbol = p.get("symbol") || "???";
  const score = parseInt(p.get("score") || "0");
  const grade = p.get("grade") || "?";
  const holders = parseInt(p.get("holders") || "0");
  const freshPct = parseFloat(p.get("freshPct") || "0");
  const veteranPct = parseFloat(p.get("veteranPct") || "0");
  const lowActivityPct = parseFloat(p.get("lowActivityPct") || "0");
  const singleTokenPct = parseFloat(p.get("singleTokenPct") || "0");
  const avgAge = parseFloat(p.get("avgAge") || "0");
  const avgTxs = parseFloat(p.get("avgTxs") || "0");
  const avgSol = parseFloat(p.get("avgSol") || "0");
  const diamondPct = parseFloat(p.get("diamondPct") || "0");
  const tokenImage = p.get("image") || "";
  const top5Pct = parseFloat(p.get("top5Pct") || "0");
  const mint = p.get("mint") || "";

  const color = gc(grade);
  const scoreLabel = score >= 80 ? "STRONG ORGANIC BASE" : score >= 65 ? "SOLID HOLDERBASE" : score >= 50 ? "MIXED SIGNALS" : score >= 35 ? "WEAK — SYBIL RISK" : "CRITICAL — SYBIL";

  const now = new Date();
  const ts = `${now.getUTCFullYear()}-${String(now.getUTCMonth()+1).padStart(2,"0")}-${String(now.getUTCDate()).padStart(2,"0")} ${String(now.getUTCHours()).padStart(2,"0")}:${String(now.getUTCMinutes()).padStart(2,"0")} UTC`;

  const metrics = [
    { label: "FRESH WALLETS", value: freshPct, display: `${freshPct}%`, barPct: Math.min(freshPct, 100) },
    { label: "VETERANS 90D+", value: veteranPct, display: `${veteranPct}%`, barPct: Math.min(veteranPct, 100) },
    { label: "LOW ACTIVITY", value: lowActivityPct, display: `${lowActivityPct}%`, barPct: Math.min(lowActivityPct, 100) },
    { label: "SINGLE TOKEN", value: singleTokenPct, display: `${singleTokenPct}%`, barPct: Math.min(singleTokenPct, 100) },
    { label: "DIAMOND HANDS", value: diamondPct, display: `${diamondPct}%`, barPct: Math.min(diamondPct, 100) },
    { label: "AVG SOL BAL", value: avgSol, display: `${avgSol} SOL`, barPct: Math.min((avgSol / 10) * 100, 100) },
  ];

  const logoUrl = "https://holdtech.fun/logo.png";

  return new ImageResponse(
    (
      <div style={{
        width: 1200, height: 630, display: "flex", flexDirection: "column",
        background: "linear-gradient(160deg, #08080f 0%, #0e0b18 50%, #08080f 100%)",
        fontFamily: "monospace", color: "#e0e0f0",
        position: "relative", overflow: "hidden",
      }}>
        {/* Grid bg */}
        <div style={{
          position: "absolute", inset: 0, display: "flex",
          backgroundImage: "linear-gradient(rgba(153,69,255,0.025) 1px, transparent 1px), linear-gradient(90deg, rgba(153,69,255,0.025) 1px, transparent 1px)",
          backgroundSize: "40px 40px",
        }} />

        {/* Score glow */}
        <div style={{
          position: "absolute", left: "120px", top: "140px", width: "300px", height: "300px",
          borderRadius: "50%", background: `radial-gradient(circle, ${color}0a, transparent 70%)`,
          display: "flex",
        }} />

        {/* ═══ HEADER ═══ */}
        <div style={{
          display: "flex", alignItems: "center", justifyContent: "space-between",
          padding: "18px 36px", position: "relative",
          borderBottom: "1px solid rgba(153,69,255,0.08)",
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <img src={logoUrl} width={26} height={26} style={{ borderRadius: "5px" }} />
            <span style={{ fontSize: "18px", fontWeight: 900, color: "#9945FF" }}>HOLD</span>
            <span style={{ fontSize: "18px", fontWeight: 900, color: "#444" }}>TECH</span>
            <div style={{ marginLeft: "6px", padding: "2px 8px", borderRadius: "3px", background: "rgba(153,69,255,0.1)", border: "1px solid rgba(153,69,255,0.2)", display: "flex" }}>
              <span style={{ fontSize: "8px", fontWeight: 800, color: "#9945FF", letterSpacing: "0.15em" }}>HOLDER QUALITY SCORE</span>
            </div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <span style={{ fontSize: "10px", color: "#333" }}>{ts}</span>
            <div style={{ padding: "3px 10px", borderRadius: "4px", background: `${color}12`, border: `1px solid ${color}25`, display: "flex" }}>
              <span style={{ fontSize: "9px", fontWeight: 800, color, letterSpacing: "0.1em" }}>{scoreLabel}</span>
            </div>
          </div>
        </div>

        {/* ═══ MAIN ═══ */}
        <div style={{ display: "flex", flex: 1, position: "relative" }}>

          {/* LEFT: Token + Score */}
          <div style={{
            display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
            width: "380px", flexShrink: 0, padding: "0 20px",
          }}>
            {/* Token */}
            <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "24px" }}>
              {tokenImage ? (
                <img src={tokenImage} width={48} height={48} style={{ borderRadius: "50%", border: `2px solid ${color}50` }} />
              ) : (
                <div style={{ width: 48, height: 48, borderRadius: "50%", background: `${color}15`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: "20px", fontWeight: 900, color, border: `2px solid ${color}50` }}>
                  {symbol.charAt(0)}
                </div>
              )}
              <div style={{ display: "flex", flexDirection: "column" }}>
                <span style={{ fontSize: "30px", fontWeight: 900, letterSpacing: "-0.03em", lineHeight: 1 }}>${symbol}</span>
                <span style={{ fontSize: "13px", color: "#555", marginTop: "3px" }}>{holders.toLocaleString()} holders</span>
              </div>
            </div>

            {/* Score */}
            <div style={{ display: "flex", alignItems: "center", gap: "14px" }}>
              <div style={{
                width: 110, height: 110, borderRadius: "50%",
                background: `linear-gradient(135deg, ${color}18, ${color}08)`,
                border: `4px solid ${color}`,
                display: "flex", alignItems: "center", justifyContent: "center",
                boxShadow: `0 0 40px ${color}20`,
              }}>
                <span style={{ fontSize: "50px", fontWeight: 900, color, lineHeight: 1 }}>{score}</span>
              </div>
              <span style={{ fontSize: "72px", fontWeight: 900, color, lineHeight: 1, letterSpacing: "-0.05em" }}>{grade}</span>
            </div>

            {/* Sub-stats in a contained row */}
            <div style={{
              display: "flex", gap: "2px", marginTop: "22px",
              background: "rgba(255,255,255,0.02)", borderRadius: "8px",
              border: "1px solid rgba(153,69,255,0.06)", padding: "10px 4px",
            }}>
              {[
                { label: "AVG AGE", value: `${avgAge}d` },
                { label: "AVG TXS", value: `${Math.round(avgTxs)}` },
                { label: "TOP 5%", value: `${top5Pct}%` },
              ].map((s, i) => (
                <div key={s.label} style={{
                  display: "flex", flexDirection: "column", alignItems: "center",
                  padding: "0 16px",
                  borderLeft: i > 0 ? "1px solid rgba(153,69,255,0.08)" : "none",
                }}>
                  <span style={{ fontSize: "20px", fontWeight: 900, color: "#ccc", lineHeight: 1 }}>{s.value}</span>
                  <span style={{ fontSize: "8px", fontWeight: 700, color: "#444", letterSpacing: "0.1em", marginTop: "4px" }}>{s.label}</span>
                </div>
              ))}
            </div>

            {/* CA */}
            {mint && (
              <span style={{ fontSize: "10px", color: "#2a2a3a", marginTop: "10px", fontFamily: "monospace" }}>
                {mint.slice(0, 8)}...{mint.slice(-6)}
              </span>
            )}
          </div>

          {/* RIGHT: Metrics */}
          <div style={{
            display: "flex", flexDirection: "column", flex: 1, justifyContent: "center",
            gap: "5px", padding: "0 36px 0 0",
            borderLeft: "1px solid rgba(153,69,255,0.06)",
            marginLeft: "0", paddingLeft: "28px",
          }}>
            {metrics.map((m) => {
              const st = metricStatus(m.label, m.value);
              return (
                <div key={m.label} style={{
                  display: "flex", alignItems: "center", gap: "10px",
                  padding: "11px 16px",
                  background: `${st.color}05`,
                  borderRadius: "8px",
                  border: `1px solid ${st.color}12`,
                }}>
                  {/* Label */}
                  <span style={{ fontSize: "11px", fontWeight: 700, color: "#555", letterSpacing: "0.06em", width: "110px", flexShrink: 0 }}>{m.label}</span>
                  {/* Bar */}
                  <div style={{ flex: 1, height: "10px", borderRadius: "5px", background: "rgba(255,255,255,0.03)", display: "flex" }}>
                    {m.barPct > 0 && (
                      <div style={{
                        width: `${Math.max(m.barPct, 2)}%`, height: "100%", borderRadius: "5px",
                        background: `linear-gradient(90deg, ${st.color}55, ${st.color})`,
                      }} />
                    )}
                  </div>
                  {/* Value */}
                  <span style={{ fontSize: "20px", fontWeight: 900, color: st.color, minWidth: "80px", textAlign: "right", lineHeight: 1 }}>
                    {m.display}
                  </span>
                  {/* Tag */}
                  <div style={{
                    display: "flex", padding: "3px 8px", borderRadius: "4px",
                    background: `${st.color}15`, minWidth: "62px", justifyContent: "center",
                  }}>
                    <span style={{ fontSize: "9px", fontWeight: 800, color: st.color, letterSpacing: "0.08em" }}>{st.tag}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* ═══ FOOTER ═══ */}
        <div style={{
          display: "flex", alignItems: "center", justifyContent: "space-between",
          padding: "12px 36px", position: "relative",
          borderTop: "1px solid rgba(153,69,255,0.06)",
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <img src={logoUrl} width={14} height={14} style={{ borderRadius: "3px", opacity: 0.5 }} />
            <span style={{ fontSize: "11px", color: "#3a3a4a", fontWeight: 600 }}>holdtech.fun</span>
          </div>
          <span style={{ fontSize: "9px", color: "#2a2a3a" }}>Powered by Helius · DexScreener</span>
        </div>
      </div>
    ),
    { width: 1200, height: 630 }
  );
}
