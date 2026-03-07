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

function metricStatus(label: string, value: number): { color: string; tag: string } {
  if (label === "FRESH WALLETS") {
    if (value > 60) return { color: "#ef4444", tag: "HIGH RISK" };
    if (value > 40) return { color: "#f97316", tag: "ELEVATED" };
    if (value > 20) return { color: "#eab308", tag: "MODERATE" };
    return { color: "#14F195", tag: "LOW" };
  }
  if (label === "VETERANS 90D+") {
    if (value > 40) return { color: "#14F195", tag: "STRONG" };
    if (value > 20) return { color: "#4ade80", tag: "DECENT" };
    return { color: "#ef4444", tag: "WEAK" };
  }
  if (label === "LOW ACTIVITY") {
    if (value > 50) return { color: "#ef4444", tag: "BURNERS" };
    if (value > 30) return { color: "#f97316", tag: "ELEVATED" };
    return { color: "#14F195", tag: "CLEAN" };
  }
  if (label === "SINGLE TOKEN") {
    if (value > 40) return { color: "#ef4444", tag: "SYBIL" };
    if (value > 20) return { color: "#f97316", tag: "ELEVATED" };
    return { color: "#14F195", tag: "CLEAN" };
  }
  if (label === "DIAMOND HANDS") {
    if (value > 60) return { color: "#14F195", tag: "STRONG" };
    if (value > 30) return { color: "#eab308", tag: "MIXED" };
    return { color: "#ef4444", tag: "WEAK" };
  }
  if (label === "AVG SOL BAL") {
    if (value >= 5) return { color: "#14F195", tag: "FUNDED" };
    if (value >= 1) return { color: "#eab308", tag: "LIGHT" };
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

  // 6 key metrics with semantic meaning
  const metrics = [
    { label: "FRESH WALLETS", value: freshPct, display: `${freshPct}%` },
    { label: "VETERANS 90D+", value: veteranPct, display: `${veteranPct}%` },
    { label: "LOW ACTIVITY", value: lowActivityPct, display: `${lowActivityPct}%` },
    { label: "SINGLE TOKEN", value: singleTokenPct, display: `${singleTokenPct}%` },
    { label: "DIAMOND HANDS", value: diamondPct, display: `${diamondPct}%` },
    { label: "AVG SOL BAL", value: avgSol, display: `${avgSol} SOL` },
  ];

  const logoUrl = "https://holdtech.fun/logo.png";

  return new ImageResponse(
    (
      <div style={{
        width: 1200, height: 630, display: "flex", flexDirection: "column",
        background: "linear-gradient(145deg, #0a0a14 0%, #0d0b1a 40%, #0a0a14 100%)",
        fontFamily: "monospace", color: "#e0e0f0",
        position: "relative", overflow: "hidden",
      }}>
        {/* Background grid */}
        <div style={{
          position: "absolute", inset: 0, display: "flex",
          backgroundImage: "linear-gradient(rgba(153,69,255,0.03) 1px, transparent 1px), linear-gradient(90deg, rgba(153,69,255,0.03) 1px, transparent 1px)",
          backgroundSize: "40px 40px",
        }} />

        {/* Score glow */}
        <div style={{
          position: "absolute", left: "380px", top: "80px", width: "440px", height: "440px",
          borderRadius: "50%", background: `radial-gradient(circle, ${color}08, transparent 60%)`,
          display: "flex",
        }} />

        {/* ═══ HEADER ═══ */}
        <div style={{
          display: "flex", alignItems: "center", justifyContent: "space-between",
          padding: "20px 36px", position: "relative",
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <img src={logoUrl} width={28} height={28} style={{ borderRadius: "6px" }} />
            <span style={{ fontSize: "20px", fontWeight: 900, color: "#9945FF" }}>HOLD</span>
            <span style={{ fontSize: "20px", fontWeight: 900, color: "#555" }}>TECH</span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
            <span style={{ fontSize: "11px", color: "#333" }}>{ts}</span>
            <div style={{ padding: "3px 10px", borderRadius: "4px", background: `${color}15`, border: `1px solid ${color}30`, display: "flex" }}>
              <span style={{ fontSize: "10px", fontWeight: 800, color, letterSpacing: "0.12em" }}>{scoreLabel}</span>
            </div>
          </div>
        </div>

        {/* ═══ MAIN: centered hero ═══ */}
        <div style={{ display: "flex", flex: 1, padding: "0 36px", gap: "0", position: "relative" }}>

          {/* CENTER: Score hero */}
          <div style={{
            display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
            width: "400px", flexShrink: 0,
          }}>
            {/* Token identity */}
            <div style={{ display: "flex", alignItems: "center", gap: "14px", marginBottom: "20px" }}>
              {tokenImage ? (
                <img src={tokenImage} width={56} height={56} style={{ borderRadius: "50%", border: `3px solid ${color}40` }} />
              ) : (
                <div style={{ width: 56, height: 56, borderRadius: "50%", background: `${color}18`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: "24px", fontWeight: 900, color, border: `3px solid ${color}40` }}>
                  {symbol.charAt(0)}
                </div>
              )}
              <div style={{ display: "flex", flexDirection: "column" }}>
                <span style={{ fontSize: "36px", fontWeight: 900, letterSpacing: "-0.03em", lineHeight: 1 }}>${symbol}</span>
                <div style={{ display: "flex", alignItems: "center", gap: "8px", marginTop: "4px" }}>
                  <span style={{ fontSize: "14px", color: "#666" }}>{holders.toLocaleString()} holders</span>
                  {mint && <span style={{ fontSize: "10px", color: "#333" }}>{mint.slice(0, 4)}...{mint.slice(-4)}</span>}
                </div>
              </div>
            </div>

            {/* SCORE — the hero */}
            <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
              {/* Score circle */}
              <div style={{
                width: 140, height: 140, borderRadius: "50%",
                background: `linear-gradient(135deg, ${color}20, ${color}08)`,
                border: `5px solid ${color}`,
                display: "flex", alignItems: "center", justifyContent: "center",
                boxShadow: `0 0 50px ${color}25, 0 0 100px ${color}10`,
              }}>
                <span style={{ fontSize: "64px", fontWeight: 900, color, lineHeight: 1 }}>{score}</span>
              </div>
              {/* Grade */}
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
                <span style={{ fontSize: "80px", fontWeight: 900, color, lineHeight: 1, letterSpacing: "-0.05em" }}>{grade}</span>
              </div>
            </div>

            {/* Quick stats row */}
            <div style={{ display: "flex", gap: "20px", marginTop: "20px" }}>
              {[
                { label: "AVG AGE", value: `${avgAge}d` },
                { label: "AVG TXS", value: `${Math.round(avgTxs)}` },
                { label: "TOP 5", value: `${top5Pct}%` },
              ].map(s => (
                <div key={s.label} style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
                  <span style={{ fontSize: "22px", fontWeight: 900, color: "#ccc", lineHeight: 1 }}>{s.value}</span>
                  <span style={{ fontSize: "9px", fontWeight: 700, color: "#444", letterSpacing: "0.1em", marginTop: "4px" }}>{s.label}</span>
                </div>
              ))}
            </div>
          </div>

          {/* RIGHT: Metric bars with semantic tags */}
          <div style={{
            display: "flex", flexDirection: "column", flex: 1, justifyContent: "center",
            gap: "6px", paddingLeft: "24px",
            borderLeft: "1px solid rgba(153,69,255,0.08)",
          }}>
            {metrics.map((m) => {
              const st = metricStatus(m.label, m.value);
              const barPct = m.label === "AVG SOL BAL" ? Math.min(m.value / 10 * 100, 100) : Math.min(m.value, 100);
              return (
                <div key={m.label} style={{
                  display: "flex", alignItems: "center", gap: "10px",
                  padding: "12px 18px",
                  background: `${st.color}06`,
                  borderRadius: "10px",
                  border: `1px solid ${st.color}15`,
                }}>
                  {/* Label */}
                  <span style={{ fontSize: "11px", fontWeight: 700, color: "#555", letterSpacing: "0.08em", width: "110px", flexShrink: 0 }}>{m.label}</span>
                  {/* Bar */}
                  <div style={{ flex: 1, height: "10px", borderRadius: "5px", background: "rgba(255,255,255,0.04)", overflow: "hidden", display: "flex" }}>
                    <div style={{
                      width: `${barPct}%`, height: "100%", borderRadius: "5px",
                      background: `linear-gradient(90deg, ${st.color}66, ${st.color})`,
                    }} />
                  </div>
                  {/* Value */}
                  <span style={{ fontSize: "22px", fontWeight: 900, color: st.color, minWidth: "75px", textAlign: "right", lineHeight: 1 }}>
                    {m.display}
                  </span>
                  {/* Tag */}
                  <div style={{ display: "flex", padding: "3px 8px", borderRadius: "4px", background: `${st.color}18` }}>
                    <span style={{ fontSize: "9px", fontWeight: 800, color: st.color, letterSpacing: "0.1em" }}>{st.tag}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* ═══ FOOTER ═══ */}
        <div style={{
          display: "flex", alignItems: "center", justifyContent: "space-between",
          padding: "14px 36px", position: "relative",
          borderTop: "1px solid rgba(153,69,255,0.06)",
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <img src={logoUrl} width={16} height={16} style={{ borderRadius: "3px", opacity: 0.6 }} />
            <span style={{ fontSize: "11px", color: "#444", fontWeight: 600 }}>holdtech.fun</span>
            <span style={{ fontSize: "11px", color: "#222" }}>·</span>
            <span style={{ fontSize: "10px", color: "#333" }}>Solana Token Intelligence</span>
          </div>
          <span style={{ fontSize: "10px", color: "#333" }}>Powered by Helius · DexScreener</span>
        </div>
      </div>
    ),
    { width: 1200, height: 630 }
  );
}
