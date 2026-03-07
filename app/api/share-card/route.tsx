import { ImageResponse } from "@vercel/og";
import { NextRequest } from "next/server";

export const runtime = "edge";

function gradeColor(g: string) {
  if (g?.startsWith("A")) return "#14F195";
  if (g?.startsWith("B")) return "#4ade80";
  if (g?.startsWith("C")) return "#eab308";
  if (g?.startsWith("D")) return "#f97316";
  return "#ef4444";
}

function scoreBg(score: number) {
  if (score >= 80) return "linear-gradient(135deg, #14F195, #0ea370)";
  if (score >= 65) return "linear-gradient(135deg, #4ade80, #22c55e)";
  if (score >= 50) return "linear-gradient(135deg, #eab308, #ca8a04)";
  if (score >= 35) return "linear-gradient(135deg, #f97316, #ea580c)";
  return "linear-gradient(135deg, #ef4444, #dc2626)";
}

export async function GET(req: NextRequest) {
  const p = req.nextUrl.searchParams;
  const symbol = p.get("symbol") || "???";
  const score = parseInt(p.get("score") || "0");
  const grade = p.get("grade") || "?";
  const holders = parseInt(p.get("holders") || "0");
  const freshPct = p.get("freshPct") || "0";
  const veteranPct = p.get("veteranPct") || "0";
  const lowActivityPct = p.get("lowActivityPct") || "0";
  const singleTokenPct = p.get("singleTokenPct") || "0";
  const avgAge = p.get("avgAge") || "0";
  const avgTxs = p.get("avgTxs") || "0";
  const avgSol = p.get("avgSol") || "0";
  const diamondPct = p.get("diamondPct") || "0";
  const tokenImage = p.get("image") || "";
  const verdict = p.get("verdict") || "";

  const gc = gradeColor(grade);
  const warnColor = "#ef4444";

  return new ImageResponse(
    (
      <div
        style={{
          width: 1200, height: 630, display: "flex", flexDirection: "column",
          background: "#0a0a12", fontFamily: "monospace", color: "#e0e0f0", position: "relative",
          overflow: "hidden",
        }}
      >
        {/* Grid background */}
        <div style={{
          position: "absolute", inset: 0, display: "flex",
          backgroundImage: "linear-gradient(rgba(153,69,255,0.06) 1px, transparent 1px), linear-gradient(90deg, rgba(153,69,255,0.06) 1px, transparent 1px)",
          backgroundSize: "40px 40px",
        }} />

        {/* Top bar */}
        <div style={{
          display: "flex", alignItems: "center", justifyContent: "space-between",
          padding: "28px 40px 0", position: "relative",
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
            <span style={{ fontSize: "24px", fontWeight: 900, color: "#9945FF" }}>HOLD</span>
            <span style={{ fontSize: "24px", fontWeight: 900, color: "#666" }}>TECH</span>
            <span style={{
              fontSize: "10px", fontWeight: 700, color: "#9945FF", border: "1px solid rgba(153,69,255,0.3)",
              padding: "2px 6px", borderRadius: "4px", marginLeft: "4px",
            }}>SCAN REPORT</span>
          </div>
          <span style={{ fontSize: "13px", color: "#555" }}>holdtech.fun</span>
        </div>

        {/* Main content */}
        <div style={{
          display: "flex", flex: 1, padding: "24px 40px 0", gap: "32px", position: "relative",
        }}>
          {/* Left: Token info + score */}
          <div style={{ display: "flex", flexDirection: "column", gap: "16px", width: "340px", flexShrink: 0 }}>
            <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
              {tokenImage ? (
                <img src={tokenImage} width={72} height={72} style={{ borderRadius: "50%", border: "2px solid rgba(153,69,255,0.3)" }} />
              ) : (
                <div style={{ width: 72, height: 72, borderRadius: "50%", background: "rgba(153,69,255,0.15)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "28px", fontWeight: 900, color: "#9945FF" }}>
                  {symbol.charAt(0)}
                </div>
              )}
              <div style={{ display: "flex", flexDirection: "column" }}>
                <span style={{ fontSize: "32px", fontWeight: 900, letterSpacing: "-0.02em" }}>${symbol}</span>
                <span style={{ fontSize: "13px", color: "#666" }}>{holders.toLocaleString()} holders</span>
              </div>
            </div>

            {/* Score circle */}
            <div style={{ display: "flex", alignItems: "center", gap: "20px", marginTop: "8px" }}>
              <div style={{
                width: 100, height: 100, borderRadius: "50%",
                background: scoreBg(score),
                display: "flex", alignItems: "center", justifyContent: "center",
                boxShadow: `0 0 30px ${gc}33`,
              }}>
                <span style={{ fontSize: "42px", fontWeight: 900, color: "#000" }}>{score}</span>
              </div>
              <div style={{ display: "flex", flexDirection: "column" }}>
                <span style={{ fontSize: "56px", fontWeight: 900, color: gc, lineHeight: 1 }}>{grade}</span>
                <span style={{ fontSize: "12px", color: "#666", marginTop: "2px" }}>
                  {score >= 80 ? "STRONG" : score >= 65 ? "SOLID" : score >= 50 ? "MIXED" : score >= 35 ? "WEAK" : "CRITICAL"}
                </span>
              </div>
            </div>

            {/* Verdict snippet */}
            {verdict && (
              <div style={{
                fontSize: "12px", color: "#888", lineHeight: 1.5,
                marginTop: "4px", maxHeight: "60px", overflow: "hidden",
              }}>
                {verdict.slice(0, 160)}{verdict.length > 160 ? "..." : ""}
              </div>
            )}
          </div>

          {/* Right: Metrics grid */}
          <div style={{
            display: "flex", flexWrap: "wrap", gap: "10px", flex: 1,
            alignContent: "flex-start",
          }}>
            {[
              { label: "FRESH WALLETS", value: `${freshPct}%`, warn: parseFloat(freshPct) > 40 },
              { label: "VETERANS (90D+)", value: `${veteranPct}%`, warn: false },
              { label: "LOW ACTIVITY", value: `${lowActivityPct}%`, warn: parseFloat(lowActivityPct) > 40 },
              { label: "SINGLE TOKEN", value: `${singleTokenPct}%`, warn: parseFloat(singleTokenPct) > 30 },
              { label: "AVG WALLET AGE", value: `${avgAge}d`, warn: false },
              { label: "AVG TX COUNT", value: avgTxs, warn: false },
              { label: "AVG SOL BAL", value: `${avgSol} SOL`, warn: parseFloat(avgSol) < 0.5 },
              { label: "DIAMOND HANDS", value: `${diamondPct}%`, warn: false },
            ].map((m) => (
              <div
                key={m.label}
                style={{
                  width: "190px", padding: "14px 16px",
                  background: "rgba(153,69,255,0.04)",
                  border: `1px solid ${m.warn ? "rgba(239,68,68,0.3)" : "rgba(153,69,255,0.1)"}`,
                  borderRadius: "10px",
                  display: "flex", flexDirection: "column",
                }}
              >
                <span style={{ fontSize: "9px", fontWeight: 700, color: "#555", letterSpacing: "0.12em" }}>{m.label}</span>
                <span style={{ fontSize: "24px", fontWeight: 800, marginTop: "4px", color: m.warn ? warnColor : "#e0e0f0" }}>{m.value}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Bottom bar */}
        <div style={{
          display: "flex", alignItems: "center", justifyContent: "space-between",
          padding: "0 40px 24px", position: "relative",
        }}>
          <span style={{ fontSize: "11px", color: "#333" }}>Solana Token Intelligence · holdtech.fun/dashboard</span>
          <span style={{ fontSize: "11px", color: "#333" }}>Powered by Helius · DexScreener</span>
        </div>
      </div>
    ),
    { width: 1200, height: 630 }
  );
}
