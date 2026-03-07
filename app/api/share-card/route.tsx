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

function scoreBg(score: number) {
  if (score >= 80) return "#14F195";
  if (score >= 65) return "#4ade80";
  if (score >= 50) return "#eab308";
  if (score >= 35) return "#f97316";
  return "#ef4444";
}

function metricColor(label: string, value: number) {
  if (label === "FRESH") return value > 60 ? "#ef4444" : value > 40 ? "#f97316" : value > 20 ? "#eab308" : "#14F195";
  if (label === "VETERANS") return value > 40 ? "#14F195" : value > 20 ? "#4ade80" : value > 10 ? "#eab308" : "#ef4444";
  if (label === "LOW ACT") return value > 50 ? "#ef4444" : value > 30 ? "#f97316" : value > 15 ? "#eab308" : "#14F195";
  if (label === "1-TOKEN") return value > 40 ? "#ef4444" : value > 20 ? "#f97316" : "#14F195";
  if (label === "💎 HANDS") return value > 60 ? "#14F195" : value > 30 ? "#4ade80" : "#eab308";
  if (label === "AVG SOL") return value < 0.5 ? "#ef4444" : value < 2 ? "#eab308" : "#14F195";
  return "#e0e0f0";
}

function barWidth(label: string, value: number) {
  if (label === "FRESH") return Math.min(value, 100);
  if (label === "VETERANS") return Math.min(value, 100);
  if (label === "LOW ACT") return Math.min(value, 100);
  if (label === "1-TOKEN") return Math.min(value, 100);
  if (label === "💎 HANDS") return Math.min(value, 100);
  if (label === "AVG AGE") return Math.min(value / 3, 100); // 300d = full
  if (label === "AVG TXS") return Math.min(value / 10, 100); // 1000 = full
  if (label === "AVG SOL") return Math.min(value / 10 * 100, 100); // 10 SOL = full
  return 50;
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
  const now = new Date();
  const timestamp = `${now.getUTCFullYear()}-${String(now.getUTCMonth()+1).padStart(2,"0")}-${String(now.getUTCDate()).padStart(2,"0")} ${String(now.getUTCHours()).padStart(2,"0")}:${String(now.getUTCMinutes()).padStart(2,"0")} UTC`;

  const color = gc(grade);
  const scoreLabel = score >= 80 ? "STRONG ORGANIC BASE" : score >= 65 ? "SOLID HOLDERBASE" : score >= 50 ? "MIXED SIGNALS" : score >= 35 ? "WEAK — HIGH SYBIL RISK" : "CRITICAL — SYBIL PATTERN";

  const metrics: { label: string; value: number; display: string; suffix: string }[] = [
    { label: "FRESH", value: freshPct, display: `${freshPct}`, suffix: "%" },
    { label: "VETERANS", value: veteranPct, display: `${veteranPct}`, suffix: "%" },
    { label: "LOW ACT", value: lowActivityPct, display: `${lowActivityPct}`, suffix: "%" },
    { label: "1-TOKEN", value: singleTokenPct, display: `${singleTokenPct}`, suffix: "%" },
    { label: "💎 HANDS", value: diamondPct, display: `${diamondPct}`, suffix: "%" },
    { label: "AVG AGE", value: avgAge, display: `${avgAge}`, suffix: "d" },
    { label: "AVG TXS", value: avgTxs, display: `${Math.round(avgTxs)}`, suffix: "" },
    { label: "AVG SOL", value: avgSol, display: `${avgSol}`, suffix: "" },
  ];

  return new ImageResponse(
    (
      <div style={{
        width: 1200, height: 630, display: "flex", flexDirection: "column",
        background: "#08080f", fontFamily: "monospace", color: "#e0e0f0",
        position: "relative", overflow: "hidden",
      }}>
        {/* Subtle grid */}
        <div style={{
          position: "absolute", inset: 0, display: "flex",
          backgroundImage: "linear-gradient(rgba(153,69,255,0.04) 1px, transparent 1px), linear-gradient(90deg, rgba(153,69,255,0.04) 1px, transparent 1px)",
          backgroundSize: "30px 30px",
        }} />

        {/* Accent glow behind score */}
        <div style={{
          position: "absolute", left: "60px", top: "120px", width: "280px", height: "280px",
          borderRadius: "50%", background: `radial-gradient(circle, ${color}15, transparent 70%)`,
          display: "flex",
        }} />

        {/* Top bar */}
        <div style={{
          display: "flex", alignItems: "center", justifyContent: "space-between",
          padding: "24px 40px", position: "relative",
          borderBottom: "1px solid rgba(153,69,255,0.1)",
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <span style={{ fontSize: "22px", fontWeight: 900, color: "#9945FF" }}>HOLD</span>
            <span style={{ fontSize: "22px", fontWeight: 900, color: "#555" }}>TECH</span>
            <div style={{ display: "flex", marginLeft: "8px", padding: "3px 10px", borderRadius: "4px", background: "rgba(153,69,255,0.12)", border: "1px solid rgba(153,69,255,0.25)" }}>
              <span style={{ fontSize: "9px", fontWeight: 700, color: "#9945FF", letterSpacing: "0.15em" }}>SCAN REPORT</span>
            </div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
            <span style={{ fontSize: "12px", color: "#333", letterSpacing: "0.05em" }}>holdtech.fun</span>
          </div>
        </div>

        {/* Main content */}
        <div style={{ display: "flex", flex: 1, padding: "28px 40px", gap: "36px", position: "relative" }}>

          {/* Left column: Token + Score hero */}
          <div style={{ display: "flex", flexDirection: "column", width: "320px", flexShrink: 0, justifyContent: "center" }}>
            {/* Token identity */}
            <div style={{ display: "flex", alignItems: "center", gap: "14px", marginBottom: "24px" }}>
              {tokenImage ? (
                <img src={tokenImage} width={52} height={52} style={{ borderRadius: "50%", border: `2px solid ${color}44` }} />
              ) : (
                <div style={{ width: 52, height: 52, borderRadius: "50%", background: `${color}20`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: "22px", fontWeight: 900, color, border: `2px solid ${color}44` }}>
                  {symbol.charAt(0)}
                </div>
              )}
              <div style={{ display: "flex", flexDirection: "column" }}>
                <span style={{ fontSize: "28px", fontWeight: 900, letterSpacing: "-0.02em", lineHeight: 1 }}>${symbol}</span>
                <span style={{ fontSize: "12px", color: "#555", marginTop: "3px" }}>{holders.toLocaleString()} holders</span>
                {mint && <span style={{ fontSize: "9px", color: "#333", marginTop: "2px", fontFamily: "monospace" }}>{mint.slice(0, 6)}...{mint.slice(-4)}</span>}
              </div>
            </div>

            {/* Score hero */}
            <div style={{ display: "flex", alignItems: "center", gap: "20px" }}>
              <div style={{ position: "relative", display: "flex", alignItems: "center", justifyContent: "center" }}>
                {/* Score ring */}
                <div style={{
                  width: 120, height: 120, borderRadius: "50%",
                  border: `4px solid ${color}`,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  background: `${color}10`,
                  boxShadow: `0 0 40px ${color}20, inset 0 0 30px ${color}08`,
                }}>
                  <span style={{ fontSize: "52px", fontWeight: 900, color, lineHeight: 1 }}>{score}</span>
                </div>
              </div>
              <div style={{ display: "flex", flexDirection: "column" }}>
                <span style={{ fontSize: "64px", fontWeight: 900, color, lineHeight: 1, letterSpacing: "-0.04em" }}>{grade}</span>
                <span style={{ fontSize: "11px", fontWeight: 700, color: `${color}aa`, letterSpacing: "0.1em", marginTop: "4px" }}>{scoreLabel}</span>
              </div>
            </div>

            {/* Top 5 concentration if available */}
            {top5Pct > 0 && (
              <div style={{ display: "flex", alignItems: "center", gap: "8px", marginTop: "20px" }}>
                <span style={{ fontSize: "10px", color: "#444", fontWeight: 700, letterSpacing: "0.1em" }}>TOP 5 HOLD</span>
                <div style={{ flex: 1, height: "6px", borderRadius: "3px", background: "rgba(153,69,255,0.08)", overflow: "hidden", display: "flex" }}>
                  <div style={{ width: `${Math.min(top5Pct, 100)}%`, height: "100%", borderRadius: "3px", background: top5Pct > 50 ? "#ef4444" : top5Pct > 30 ? "#f97316" : "#9945FF" }} />
                </div>
                <span style={{ fontSize: "12px", fontWeight: 800, color: top5Pct > 50 ? "#ef4444" : "#9945FF" }}>{top5Pct}%</span>
              </div>
            )}
          </div>

          {/* Right column: Metrics with visual bars */}
          <div style={{ display: "flex", flexDirection: "column", flex: 1, gap: "8px", justifyContent: "center" }}>
            {metrics.map((m) => {
              const mc = metricColor(m.label, m.value);
              const bw = barWidth(m.label, m.value);
              return (
                <div key={m.label} style={{
                  display: "flex", alignItems: "center", gap: "12px",
                  padding: "10px 16px",
                  background: "rgba(255,255,255,0.02)",
                  borderRadius: "8px",
                  border: "1px solid rgba(153,69,255,0.06)",
                }}>
                  <span style={{ fontSize: "10px", fontWeight: 700, color: "#555", letterSpacing: "0.1em", width: "80px", flexShrink: 0 }}>{m.label}</span>
                  <div style={{ flex: 1, height: "8px", borderRadius: "4px", background: "rgba(255,255,255,0.04)", overflow: "hidden", display: "flex" }}>
                    <div style={{ width: `${bw}%`, height: "100%", borderRadius: "4px", background: `linear-gradient(90deg, ${mc}88, ${mc})` }} />
                  </div>
                  <span style={{ fontSize: "20px", fontWeight: 900, color: mc, minWidth: "70px", textAlign: "right", lineHeight: 1 }}>
                    {m.display}<span style={{ fontSize: "12px", fontWeight: 600, color: `${mc}88` }}>{m.suffix}</span>
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Bottom bar */}
        <div style={{
          display: "flex", alignItems: "center", justifyContent: "space-between",
          padding: "0 40px 20px", position: "relative",
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
            <span style={{ fontSize: "10px", color: "#333", letterSpacing: "0.08em" }}>SOLANA TOKEN INTELLIGENCE</span>
            <div style={{ width: "1px", height: "10px", background: "#222", display: "flex" }} />
            <span style={{ fontSize: "10px", color: "#333" }}>Powered by Helius · DexScreener · {timestamp}</span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
            <div style={{ width: "6px", height: "6px", borderRadius: "50%", background: color, display: "flex" }} />
            <span style={{ fontSize: "10px", color: "#444", fontWeight: 700 }}>holdtech.fun/dashboard</span>
          </div>
        </div>
      </div>
    ),
    { width: 1200, height: 630 }
  );
}
