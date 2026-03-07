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

function badgeStyle(tag: string): { bg: string; fg: string } {
  switch (tag) {
    case "DIAMOND": return { bg: "#0a2a4a", fg: "#60C0FF" };
    case "STRONG": return { bg: "#0a2a1a", fg: "#14F195" };
    case "CLEAN": return { bg: "#1a2228", fg: "#8899aa" };
    case "DECENT": return { bg: "#2a2a12", fg: "#C4A830" };
    case "SOLID": return { bg: "#0a2a1a", fg: "#4ade80" };
    case "OK": return { bg: "#1a2228", fg: "#8899aa" };
    case "SOME": case "LOW": return { bg: "#2a2210", fg: "#eab308" };
    case "CAUTION": case "ELEVATED": case "HIGH": return { bg: "#2a1a10", fg: "#f97316" };
    case "LIGHT": return { bg: "#2a2210", fg: "#C4A830" };
    case "WEAK": case "PAPER": return { bg: "#2a1a10", fg: "#f97316" };
    case "DANGER": case "SYBIL": case "BURNERS": case "ABSENT": case "DUST": return { bg: "#2a0a0a", fg: "#ef4444" };
    case "FUNDED": return { bg: "#0a2a1a", fg: "#14F195" };
    default: return { bg: "#1a1a2a", fg: "#888" };
  }
}

function metricStatus(label: string, value: number): { color: string; tag: string } {
  if (label === "FRESH WALLETS") {
    if (value <= 10) return { color: "#8899aa", tag: "CLEAN" };
    if (value <= 30) return { color: "#4ade80", tag: "OK" };
    if (value <= 50) return { color: "#eab308", tag: "CAUTION" };
    return { color: "#ef4444", tag: "DANGER" };
  }
  if (label === "VETERANS 90D+") {
    if (value >= 50) return { color: "#14F195", tag: "STRONG" };
    if (value >= 25) return { color: "#4ade80", tag: "SOLID" };
    if (value >= 10) return { color: "#eab308", tag: "LOW" };
    return { color: "#ef4444", tag: "ABSENT" };
  }
  if (label === "LOW ACTIVITY") {
    if (value <= 15) return { color: "#8899aa", tag: "CLEAN" };
    if (value <= 30) return { color: "#eab308", tag: "SOME" };
    if (value <= 50) return { color: "#f97316", tag: "HIGH" };
    return { color: "#ef4444", tag: "BURNERS" };
  }
  if (label === "SINGLE TOKEN") {
    if (value <= 10) return { color: "#8899aa", tag: "CLEAN" };
    if (value <= 25) return { color: "#eab308", tag: "SOME" };
    if (value <= 40) return { color: "#f97316", tag: "HIGH" };
    return { color: "#ef4444", tag: "SYBIL" };
  }
  if (label === "DIAMOND HANDS") {
    if (value >= 60) return { color: "#60C0FF", tag: "DIAMOND" };
    if (value >= 35) return { color: "#4ade80", tag: "SOLID" };
    if (value >= 15) return { color: "#eab308", tag: "WEAK" };
    return { color: "#ef4444", tag: "PAPER" };
  }
  if (label === "AVG SOL BAL") {
    if (value >= 5) return { color: "#14F195", tag: "FUNDED" };
    if (value >= 1) return { color: "#C4A830", tag: "DECENT" };
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
  const scoreLabel = score >= 80 ? "STRONG" : score >= 65 ? "SOLID" : score >= 50 ? "MIXED" : score >= 35 ? "WEAK" : "CRITICAL";

  const now = new Date();
  const ts = `${now.getUTCFullYear()}-${String(now.getUTCMonth()+1).padStart(2,"0")}-${String(now.getUTCDate()).padStart(2,"0")}`;

  const metrics = [
    { label: "FRESH WALLETS", value: freshPct, display: `${freshPct}%`, barPct: Math.min(freshPct, 100) },
    { label: "VETERANS 90D+", value: veteranPct, display: `${veteranPct}%`, barPct: Math.min(veteranPct, 100) },
    { label: "LOW ACTIVITY", value: lowActivityPct, display: `${lowActivityPct}%`, barPct: Math.min(lowActivityPct, 100) },
    { label: "SINGLE TOKEN", value: singleTokenPct, display: `${singleTokenPct}%`, barPct: Math.min(singleTokenPct, 100) },
    { label: "DIAMOND HANDS", value: diamondPct, display: `${diamondPct}%`, barPct: Math.min(diamondPct, 100) },
    { label: "AVG SOL BAL", value: avgSol, display: `${avgSol}`, barPct: Math.min((avgSol / 10) * 100, 100) },
  ];

  const logoUrl = "https://holdtech.fun/logo.png";

  return new ImageResponse(
    (
      <div style={{
        width: 1200, height: 630, display: "flex", flexDirection: "column",
        background: "#0a0e12", fontFamily: "monospace", color: "#e0e0f0",
        position: "relative", overflow: "hidden",
      }}>
        {/* Background depth layers */}

        {/* Large geometric diamond - rotated square, bottom-right */}
        <div style={{
          position: "absolute", right: "-80px", bottom: "-120px", width: "500px", height: "500px",
          transform: "rotate(45deg)",
          background: `linear-gradient(135deg, ${color}06, ${color}02, transparent)`,
          border: `1px solid ${color}08`,
          display: "flex",
        }} />
        {/* Second diamond - smaller, overlapping */}
        <div style={{
          position: "absolute", right: "60px", bottom: "-40px", width: "320px", height: "320px",
          transform: "rotate(45deg)",
          background: `linear-gradient(135deg, ${color}04, transparent)`,
          border: `1px solid ${color}06`,
          display: "flex",
        }} />
        {/* Third diamond - top area accent */}
        <div style={{
          position: "absolute", right: "200px", top: "-160px", width: "280px", height: "280px",
          transform: "rotate(45deg)",
          background: `linear-gradient(180deg, rgba(153,69,255,0.03), transparent)`,
          border: `1px solid rgba(153,69,255,0.04)`,
          display: "flex",
        }} />

        {/* Diagonal accent lines */}
        <div style={{
          position: "absolute", right: "180px", top: "0px", width: "1px", height: "900px",
          transform: "rotate(35deg)", transformOrigin: "top right",
          background: `linear-gradient(180deg, transparent, ${color}08, transparent)`,
          display: "flex",
        }} />
        <div style={{
          position: "absolute", right: "320px", top: "0px", width: "1px", height: "900px",
          transform: "rotate(35deg)", transformOrigin: "top right",
          background: "linear-gradient(180deg, transparent, rgba(153,69,255,0.06), transparent)",
          display: "flex",
        }} />

        {/* Radial glow - brand color, offset */}
        <div style={{
          position: "absolute", left: "50px", top: "80px", width: "500px", height: "500px",
          borderRadius: "50%",
          background: `radial-gradient(circle, ${color}0c, transparent 70%)`,
          display: "flex",
        }} />
        {/* Secondary glow top-right */}
        <div style={{
          position: "absolute", right: "-100px", top: "-100px", width: "500px", height: "500px",
          borderRadius: "50%",
          background: "radial-gradient(circle, rgba(153,69,255,0.04), transparent 70%)",
          display: "flex",
        }} />
        {/* Score glow - intense, behind the circle */}
        <div style={{
          position: "absolute", left: "160px", top: "220px", width: "200px", height: "200px",
          borderRadius: "50%",
          background: `radial-gradient(circle, ${color}12, transparent 70%)`,
          display: "flex",
        }} />
        {/* Vignette */}
        <div style={{
          position: "absolute", inset: 0, display: "flex",
          background: "radial-gradient(ellipse at 35% 50%, transparent 30%, rgba(0,0,0,0.4) 100%)",
        }} />
        {/* Subtle grid */}
        <div style={{
          position: "absolute", inset: 0, display: "flex", opacity: 0.35,
          backgroundImage: "linear-gradient(rgba(153,69,255,0.04) 1px, transparent 1px), linear-gradient(90deg, rgba(153,69,255,0.04) 1px, transparent 1px)",
          backgroundSize: "48px 48px",
        }} />

        {/* ═══ HEADER ═══ */}
        <div style={{
          display: "flex", alignItems: "center", justifyContent: "space-between",
          padding: "20px 44px", position: "relative",
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <img src={logoUrl} width={24} height={24} style={{ borderRadius: "5px" }} />
            <span style={{ fontSize: "16px", fontWeight: 900, color: "#9945FF" }}>HOLD</span>
            <span style={{ fontSize: "16px", fontWeight: 900, color: "#3a3a4a" }}>TECH</span>
          </div>
          <span style={{ fontSize: "11px", color: "#2a2a3a" }}>{ts} · holdtech.fun</span>
        </div>

        {/* ═══ MAIN ═══ */}
        <div style={{ display: "flex", flex: 1, position: "relative", padding: "0 44px" }}>

          {/* LEFT: Score hero */}
          <div style={{
            display: "flex", flexDirection: "column", justifyContent: "center",
            width: "400px", flexShrink: 0,
          }}>
            {/* Token */}
            <div style={{ display: "flex", alignItems: "center", gap: "14px", marginBottom: "28px" }}>
              {tokenImage ? (
                <img src={tokenImage} width={52} height={52} style={{ borderRadius: "50%", border: `2px solid ${color}40` }} />
              ) : (
                <div style={{ width: 52, height: 52, borderRadius: "50%", background: `${color}12`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: "22px", fontWeight: 900, color, border: `2px solid ${color}40` }}>
                  {symbol.charAt(0)}
                </div>
              )}
              <div style={{ display: "flex", flexDirection: "column" }}>
                <span style={{ fontSize: "38px", fontWeight: 900, letterSpacing: "-0.03em", lineHeight: 1, color: "#ffffff" }}>${symbol}</span>
                <span style={{ fontSize: "14px", color: "#556", marginTop: "4px" }}>{holders.toLocaleString()} holders</span>
              </div>
            </div>

            {/* THE SCORE — bold filled anchor */}
            <div style={{ display: "flex", alignItems: "center", gap: "18px" }}>
              {/* Filled score circle */}
              <div style={{
                width: 120, height: 120, borderRadius: "50%",
                background: `linear-gradient(135deg, ${color}, ${color}cc)`,
                display: "flex", alignItems: "center", justifyContent: "center",
                boxShadow: `0 0 50px ${color}30, 0 0 100px ${color}15`,
              }}>
                <span style={{ fontSize: "56px", fontWeight: 900, color: "#0a0e12", lineHeight: 1 }}>{score}</span>
              </div>
              <div style={{ display: "flex", flexDirection: "column" }}>
                <span style={{ fontSize: "80px", fontWeight: 900, color, lineHeight: 0.85, letterSpacing: "-0.05em" }}>{grade}</span>
                <span style={{ fontSize: "13px", fontWeight: 800, color: "#4a4a5a", letterSpacing: "0.12em", marginTop: "6px" }}>{scoreLabel}</span>
              </div>
            </div>

            {/* Quick stats */}
            <div style={{
              display: "flex", gap: "0px", marginTop: "28px",
              borderRadius: "8px", border: "1px solid rgba(255,255,255,0.04)",
            }}>
              {[
                { label: "AVG AGE", value: `${avgAge}d` },
                { label: "AVG TXS", value: `${Math.round(avgTxs)}` },
                { label: "TOP 5", value: `${top5Pct}%` },
              ].map((s, i) => (
                <div key={s.label} style={{
                  display: "flex", flexDirection: "column", alignItems: "center",
                  padding: "12px 22px", flex: 1,
                  borderLeft: i > 0 ? "1px solid rgba(255,255,255,0.04)" : "none",
                  background: "rgba(255,255,255,0.015)",
                }}>
                  <span style={{ fontSize: "22px", fontWeight: 900, color: "#ddd", lineHeight: 1 }}>{s.value}</span>
                  <span style={{ fontSize: "9px", fontWeight: 700, color: "#3a3a4a", letterSpacing: "0.12em", marginTop: "5px" }}>{s.label}</span>
                </div>
              ))}
            </div>

            {/* CA */}
            {mint && (
              <span style={{ fontSize: "10px", color: "#222", marginTop: "12px", fontFamily: "monospace", letterSpacing: "0.05em" }}>
                {mint.slice(0, 8)}...{mint.slice(-6)}
              </span>
            )}
          </div>

          {/* RIGHT: Metrics — clean rows with tier-colored badges */}
          <div style={{
            display: "flex", flexDirection: "column", flex: 1, justifyContent: "center",
            gap: "8px", paddingLeft: "36px",
            borderLeft: "1px solid rgba(255,255,255,0.03)",
          }}>
            {metrics.map((m) => {
              const st = metricStatus(m.label, m.value);
              const bs = badgeStyle(st.tag);
              return (
                <div key={m.label} style={{
                  display: "flex", alignItems: "center", gap: "14px",
                  padding: "13px 0",
                  borderBottom: "1px solid rgba(255,255,255,0.025)",
                }}>
                  {/* Label — muted */}
                  <span style={{ fontSize: "12px", fontWeight: 600, color: "#5a6270", letterSpacing: "0.04em", width: "120px", flexShrink: 0 }}>{m.label}</span>
                  {/* Bar — thin, glowing */}
                  <div style={{ flex: 1, height: "5px", borderRadius: "3px", background: "rgba(255,255,255,0.03)", display: "flex" }}>
                    {m.barPct > 0 && (
                      <div style={{
                        width: `${Math.max(m.barPct, 3)}%`, height: "100%", borderRadius: "3px",
                        background: `linear-gradient(90deg, ${st.color}44, ${st.color})`,
                        boxShadow: `0 0 8px ${st.color}30`,
                      }} />
                    )}
                  </div>
                  {/* Value — bold white */}
                  <span style={{ fontSize: "22px", fontWeight: 900, color: "#fff", minWidth: "70px", textAlign: "right", lineHeight: 1 }}>
                    {m.display}
                  </span>
                  {/* Badge — tier colored */}
                  <div style={{
                    display: "flex", padding: "4px 10px", borderRadius: "4px",
                    background: bs.bg, minWidth: "72px", justifyContent: "center",
                  }}>
                    <span style={{ fontSize: "10px", fontWeight: 800, color: bs.fg, letterSpacing: "0.08em" }}>{st.tag}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* ═══ FOOTER ═══ */}
        <div style={{
          display: "flex", alignItems: "center", justifyContent: "space-between",
          padding: "14px 44px", position: "relative",
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
            <img src={logoUrl} width={12} height={12} style={{ borderRadius: "2px", opacity: 0.4 }} />
            <span style={{ fontSize: "10px", color: "#2a2a3a" }}>Solana Token Intelligence</span>
          </div>
          <span style={{ fontSize: "9px", color: "#1a1a2a" }}>Powered by Helius · DexScreener</span>
        </div>
      </div>
    ),
    { width: 1200, height: 630 }
  );
}
