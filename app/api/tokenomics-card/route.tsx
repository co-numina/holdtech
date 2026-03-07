import { ImageResponse } from "@vercel/og";

export const runtime = "edge";

export async function GET() {
  const logoUrl = "https://www.holdtech.fun/logo.png";

  return new ImageResponse(
    (
      <div style={{
        width: 1200, height: 1500, display: "flex", flexDirection: "column",
        background: "#07070e", fontFamily: "system-ui, sans-serif", color: "#e0e0f0",
        position: "relative", overflow: "hidden",
      }}>
        {/* Ambient glows */}
        <div style={{ position: "absolute", top: "-100px", left: "300px", width: "600px", height: "600px", borderRadius: "50%", background: "radial-gradient(circle, rgba(153,69,255,0.07), transparent 70%)", display: "flex" }} />
        <div style={{ position: "absolute", bottom: "0", right: "100px", width: "500px", height: "500px", borderRadius: "50%", background: "radial-gradient(circle, rgba(20,241,149,0.04), transparent 70%)", display: "flex" }} />

        {/* Top accent */}
        <div style={{ width: "100%", height: "4px", background: "linear-gradient(90deg, #9945FF, #14F195)", display: "flex", flexShrink: 0 }} />

        {/* ═══ HEADER ═══ */}
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", padding: "50px 80px 20px", gap: "14px" }}>
          <img src={logoUrl} width={88} height={88} style={{ borderRadius: "18px" }} />
          <div style={{ display: "flex", alignItems: "baseline", gap: "0px", marginTop: "6px" }}>
            <span style={{ fontSize: "58px", fontWeight: 900, color: "#fff", letterSpacing: "3px" }}>$HOLD</span>
            <span style={{ fontSize: "58px", fontWeight: 900, color: "#9945FF", letterSpacing: "3px" }}>TECH</span>
          </div>
          <span style={{ fontSize: "20px", fontWeight: 500, color: "#707088", marginTop: "-4px" }}>Holder quality intelligence for Solana</span>
        </div>

        {/* ═══ WHY HOLD ═══ */}
        <div style={{ display: "flex", flexDirection: "column", padding: "30px 100px 20px", gap: "12px" }}>
          <span style={{ fontSize: "13px", fontWeight: 800, color: "#9945FF", letterSpacing: "4px" }}>WHY HOLD $HOLDTECH?</span>
          <span style={{ fontSize: "26px", fontWeight: 600, color: "#d0d0e0", lineHeight: 1.5 }}>
            The scanner is free. Premium features are token-gated. Hold $HOLDTECH to unlock deep scans, API access, batch scanning, alerts, and more.
          </span>
        </div>

        {/* ═══ TOKEN-GATED TIERS ═══ */}
        <div style={{ display: "flex", flexDirection: "column", padding: "20px 100px 10px", gap: "12px" }}>
          <span style={{ fontSize: "13px", fontWeight: 800, color: "#14F195", letterSpacing: "4px" }}>TOKEN-GATED ACCESS</span>

          {/* Tiers as horizontal blocks */}
          {[
            { name: "FREE", hold: "", color: "#556677", bg: "rgba(255,255,255,0.02)", border: "rgba(255,255,255,0.06)", desc: "Basic scans · Bundler feed · 3 watchlist slots" },
            { name: "SCOUT", hold: "5M", color: "#9945FF", bg: "rgba(153,69,255,0.04)", border: "rgba(153,69,255,0.15)", desc: "Deep scans · Scan history · Batch 5 tokens · All filters" },
            { name: "OPERATOR", hold: "10M", color: "#b06aff", bg: "rgba(176,106,255,0.05)", border: "rgba(176,106,255,0.18)", desc: "API access · Batch 20 · Custom bundler groups · Priority RPC" },
            { name: "WHALE", hold: "20M", color: "#14F195", bg: "rgba(20,241,149,0.04)", border: "rgba(20,241,149,0.15)", desc: "Unlimited everything · Raw export · Early features · Batch 50" },
          ].map((t) => (
            <div key={t.name} style={{
              display: "flex", alignItems: "center", padding: "20px 28px",
              borderRadius: "14px", background: t.bg,
              border: `1px solid ${t.border}`,
              borderLeft: t.hold ? `4px solid ${t.color}` : `1px solid ${t.border}`,
              gap: "20px",
            }}>
              <div style={{ display: "flex", flexDirection: "column", minWidth: "130px" }}>
                <span style={{ fontSize: "20px", fontWeight: 900, color: t.color, letterSpacing: "2px" }}>{t.name}</span>
                {t.hold ? (
                  <span style={{ fontSize: "14px", fontWeight: 700, color: t.color, opacity: 0.7, marginTop: "2px", display: "flex" }}>Hold {t.hold}</span>
                ) : (
                  <span style={{ fontSize: "14px", color: "#3a3a4a", marginTop: "2px", display: "flex" }}>No cost</span>
                )}
              </div>
              <span style={{ fontSize: "16px", color: "#909098", lineHeight: 1.5 }}>{t.desc}</span>
            </div>
          ))}
        </div>

        {/* ═══ BURN FLYWHEEL ═══ */}
        <div style={{ display: "flex", flexDirection: "column", padding: "25px 100px 15px", gap: "14px" }}>
          <span style={{ fontSize: "13px", fontWeight: 800, color: "#f97316", letterSpacing: "4px" }}>🔥 BURN FLYWHEEL</span>
          
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "0", padding: "10px 0" }}>
            {[
              { icon: "🔍", label: "Users scan", sub: "tokens" },
              { icon: "🔥", label: "$HOLDTECH", sub: "burned" },
              { icon: "📉", label: "Supply", sub: "shrinks" },
              { icon: "📈", label: "Value", sub: "accrues" },
            ].map((s, i) => (
              <div key={s.label} style={{ display: "flex", alignItems: "center" }}>
                <div style={{ display: "flex", flexDirection: "column", alignItems: "center", padding: "14px 24px" }}>
                  <span style={{ fontSize: "32px" }}>{s.icon}</span>
                  <span style={{ fontSize: "15px", fontWeight: 800, color: "#e0e0f0", marginTop: "8px" }}>{s.label}</span>
                  <span style={{ fontSize: "13px", color: "#555568" }}>{s.sub}</span>
                </div>
                {i < 3 && <span style={{ fontSize: "28px", color: "#333348", display: "flex", padding: "0 6px" }}>›</span>}
              </div>
            ))}
            <span style={{ fontSize: "24px", color: "#9945FF", padding: "0 0 0 12px", display: "flex", fontWeight: 900 }}>↻</span>
          </div>

          <div style={{
            display: "flex", padding: "14px 24px", borderRadius: "10px",
            background: "rgba(249,115,22,0.06)", border: "1px solid rgba(249,115,22,0.12)",
            justifyContent: "center",
          }}>
            <span style={{ fontSize: "16px", fontWeight: 600, color: "#c0a060" }}>Every premium scan burns tokens. More users = less supply = price follows product.</span>
          </div>
        </div>

        {/* ═══ COMING SOON ═══ */}
        <div style={{ display: "flex", flexDirection: "column", padding: "20px 100px 15px", gap: "12px" }}>
          <span style={{ fontSize: "13px", fontWeight: 800, color: "#9945FF", letterSpacing: "4px" }}>COMING SOON</span>
          
          <div style={{ display: "flex", gap: "14px", flexWrap: "wrap" }}>
            {[
              { icon: "🤖", label: "Telegram Bot", desc: "Scan in any group chat" },
              { icon: "🔌", label: "Public API", desc: "Build on HoldTech data" },
              { icon: "🔔", label: "Real-time Alerts", desc: "Holderbase change notifications" },
              { icon: "📊", label: "Portfolio Scanner", desc: "Scan your entire bag" },
            ].map((item) => (
              <div key={item.label} style={{
                display: "flex", flexDirection: "column", padding: "18px 22px",
                borderRadius: "12px", background: "rgba(153,69,255,0.03)",
                border: "1px solid rgba(153,69,255,0.08)",
                width: "240px", gap: "4px",
              }}>
                <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                  <span style={{ fontSize: "20px" }}>{item.icon}</span>
                  <span style={{ fontSize: "16px", fontWeight: 800, color: "#d0d0e0" }}>{item.label}</span>
                </div>
                <span style={{ fontSize: "13px", color: "#606070" }}>{item.desc}</span>
              </div>
            ))}
          </div>
        </div>

        {/* ═══ FOOTER ═══ */}
        <div style={{
          display: "flex", flexDirection: "column", alignItems: "center",
          padding: "20px 80px 40px", gap: "12px", marginTop: "auto",
        }}>
          <div style={{ width: "400px", height: "1px", background: "linear-gradient(90deg, transparent, rgba(153,69,255,0.2), transparent)", display: "flex" }} />
          <div style={{
            display: "flex", padding: "14px 44px",
            background: "linear-gradient(135deg, #9945FF, #14F195)",
            borderRadius: "12px",
          }}>
            <span style={{ fontSize: "18px", fontWeight: 900, color: "#060610", letterSpacing: "1px" }}>holdtech.fun</span>
          </div>
          <span style={{ fontSize: "12px", color: "#333348" }}>The product is shipped. The flywheel is burning. 🛡️</span>
        </div>

        {/* Bottom accent */}
        <div style={{ width: "100%", height: "4px", background: "linear-gradient(90deg, #9945FF, #14F195)", display: "flex", flexShrink: 0 }} />
      </div>
    ),
    { width: 1200, height: 1500 }
  );
}
