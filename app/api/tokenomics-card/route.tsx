import { ImageResponse } from "@vercel/og";

export const runtime = "edge";

export async function GET() {
  const logoUrl = "https://www.holdtech.fun/logo.png";
  const bgUrl = "https://www.holdtech.fun/card-bg.png";

  const tiers = [
    { name: "FREE", hold: "", color: "#556677", borderColor: "#33445530", features: ["Bundler feed", "Single scans", "3 watchlist slots", "Rate-limited batch"] },
    { name: "SCOUT", hold: "Hold 5M", color: "#9945FF", borderColor: "#9945FF40", features: ["10 watchlist", "Batch 5 tokens", "Scan history", "All group filters"] },
    { name: "OPERATOR", hold: "Hold 10M", color: "#b06aff", borderColor: "#b06aff50", features: ["50 watchlist", "Batch 20", "Bundler groups", "API access", "Priority RPC"] },
    { name: "WHALE", hold: "Hold 20M", color: "#14F195", borderColor: "#14F19550", features: ["200 watchlist", "Batch 50", "Raw export", "Early features", "Unlimited"] },
  ];

  return new ImageResponse(
    (
      <div style={{
        width: 1200, height: 1600, display: "flex", flexDirection: "column",
        background: "#050508", fontFamily: "monospace", color: "#e0e0f0",
        position: "relative", overflow: "hidden",
      }}>
        {/* BG image */}
        <img src={bgUrl} width={1200} height={1600} style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover" }} />
        
        {/* Dark overlay */}
        <div style={{
          position: "absolute", inset: 0, display: "flex",
          background: "linear-gradient(180deg, rgba(5,5,12,0.92) 0%, rgba(5,5,12,0.85) 50%, rgba(5,5,12,0.92) 100%)",
        }} />

        {/* Content panel */}
        <div style={{
          position: "absolute", left: "24px", top: "24px", right: "24px", bottom: "24px",
          background: "rgba(8,8,16,0.88)",
          borderRadius: "20px",
          border: "1px solid rgba(153,69,255,0.1)",
          display: "flex",
        }} />

        {/* Score glow top */}
        <div style={{
          position: "absolute", left: "500px", top: "-50px", width: "300px", height: "300px",
          borderRadius: "50%",
          background: "radial-gradient(circle, rgba(153,69,255,0.12), transparent 70%)",
          display: "flex",
        }} />

        {/* Glow bottom */}
        <div style={{
          position: "absolute", right: "200px", bottom: "100px", width: "400px", height: "400px",
          borderRadius: "50%",
          background: "radial-gradient(circle, rgba(20,241,149,0.06), transparent 70%)",
          display: "flex",
        }} />

        {/* Top accent */}
        <div style={{ position: "absolute", top: "24px", left: "24px", right: "24px", height: "3px", borderRadius: "20px 20px 0 0", background: "linear-gradient(90deg, #9945FF, #14F195)", display: "flex" }} />

        {/* ═══ HEADER ═══ */}
        <div style={{
          display: "flex", flexDirection: "column", alignItems: "center",
          padding: "55px 60px 25px", position: "relative", gap: "10px",
        }}>
          <img src={logoUrl} width={72} height={72} style={{ borderRadius: "14px", boxShadow: "0 0 40px rgba(153,69,255,0.2)" }} />
          <div style={{ display: "flex", alignItems: "baseline", gap: "4px", marginTop: "8px" }}>
            <span style={{ fontSize: "52px", fontWeight: 900, color: "#ffffff", letterSpacing: "2px" }}>$HOLD</span>
            <span style={{ fontSize: "52px", fontWeight: 900, color: "#9945FF", letterSpacing: "2px" }}>TECH</span>
          </div>
          <span style={{ fontSize: "13px", fontWeight: 700, color: "#4a4a5a", letterSpacing: "6px" }}>TOKENOMICS & UTILITY</span>
        </div>

        {/* Divider */}
        <div style={{ width: "500px", height: "1px", background: "linear-gradient(90deg, transparent, rgba(153,69,255,0.2), transparent)", display: "flex", alignSelf: "center", margin: "5px 0 15px", position: "relative" }} />

        {/* ═══ WHAT IT IS ═══ */}
        <div style={{ display: "flex", flexDirection: "column", padding: "0 80px", position: "relative", gap: "10px" }}>
          <span style={{ fontSize: "11px", fontWeight: 800, color: "#9945FF", letterSpacing: "4px" }}>WHAT IS $HOLDTECH</span>
          <span style={{ fontSize: "22px", fontWeight: 600, color: "#c0c0d0", lineHeight: 1.5 }}>
            The utility token powering holder quality intelligence for Solana. Scan any token's holderbase — wallet age, bundler detection, funding clusters, sybil patterns.
          </span>
        </div>

        {/* ═══ FLYWHEEL ═══ */}
        <div style={{ display: "flex", flexDirection: "column", padding: "25px 80px 15px", position: "relative", gap: "14px" }}>
          <span style={{ fontSize: "11px", fontWeight: 800, color: "#14F195", letterSpacing: "4px" }}>THE FLYWHEEL</span>
          
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "0" }}>
            {[
              { emoji: "🔍", label: "Traders scan", color: "#9945FF" },
              { emoji: "🔥", label: "Tokens burned", color: "#f97316" },
              { emoji: "📉", label: "Supply shrinks", color: "#14F195" },
              { emoji: "📈", label: "Value accrues", color: "#b06aff" },
            ].map((step, i) => (
              <div key={step.label} style={{ display: "flex", alignItems: "center" }}>
                <div style={{
                  display: "flex", flexDirection: "column", alignItems: "center",
                  padding: "16px 28px", background: `${step.color}08`,
                  borderRadius: "12px", border: `1px solid ${step.color}25`,
                  minWidth: "140px",
                }}>
                  <span style={{ fontSize: "24px" }}>{step.emoji}</span>
                  <span style={{ fontSize: "13px", fontWeight: 700, color: step.color, marginTop: "6px" }}>{step.label}</span>
                </div>
                {i < 3 && (
                  <span style={{ fontSize: "18px", color: "#3a3a4a", padding: "0 8px", display: "flex" }}>→</span>
                )}
              </div>
            ))}
            <span style={{ fontSize: "16px", color: "#9945FF", padding: "0 0 0 8px", display: "flex", fontWeight: 900 }}>↻</span>
          </div>

          <span style={{ fontSize: "13px", color: "#4a4a58", textAlign: "center", display: "flex", justifyContent: "center" }}>Every deep scan burns tokens permanently. More usage = less supply. Product drives price.</span>
        </div>

        {/* Divider */}
        <div style={{ width: "500px", height: "1px", background: "linear-gradient(90deg, transparent, rgba(153,69,255,0.15), transparent)", display: "flex", alignSelf: "center", margin: "10px 0", position: "relative" }} />

        {/* ═══ HOLD TIERS ═══ */}
        <div style={{ display: "flex", flexDirection: "column", padding: "10px 80px", position: "relative", gap: "10px" }}>
          <span style={{ fontSize: "11px", fontWeight: 800, color: "#14F195", letterSpacing: "4px" }}>HOLD TIERS</span>

          {tiers.map((tier) => (
            <div key={tier.name} style={{
              display: "flex", alignItems: "center", padding: "16px 22px",
              borderRadius: "12px", background: "rgba(255,255,255,0.015)",
              border: `1px solid ${tier.borderColor}`,
              borderLeft: tier.hold ? `3px solid ${tier.color}` : `1px solid ${tier.borderColor}`,
              gap: "16px",
            }}>
              {/* Tier name */}
              <div style={{ display: "flex", flexDirection: "column", minWidth: "120px", gap: "4px" }}>
                <span style={{ fontSize: "16px", fontWeight: 900, color: tier.color, letterSpacing: "2px" }}>{tier.name}</span>
                {tier.hold ? (
                  <span style={{ fontSize: "11px", fontWeight: 700, color: tier.color, background: `${tier.color}15`, padding: "2px 8px", borderRadius: "4px", display: "flex", width: "fit-content" }}>{tier.hold}</span>
                ) : (
                  <span style={{ fontSize: "11px", color: "#3a3a4a", display: "flex" }}>No tokens needed</span>
                )}
              </div>

              {/* Features */}
              <div style={{ display: "flex", gap: "12px", flexWrap: "wrap", flex: 1 }}>
                {tier.features.map((f) => (
                  <div key={f} style={{
                    display: "flex", alignItems: "center", gap: "6px",
                    padding: "4px 12px", borderRadius: "6px",
                    background: "rgba(255,255,255,0.03)",
                    border: "1px solid rgba(255,255,255,0.04)",
                  }}>
                    <span style={{ fontSize: "13px", color: "#909098", fontWeight: 500 }}>{f}</span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* Divider */}
        <div style={{ width: "500px", height: "1px", background: "linear-gradient(90deg, transparent, rgba(153,69,255,0.15), transparent)", display: "flex", alignSelf: "center", margin: "12px 0", position: "relative" }} />

        {/* ═══ API ═══ */}
        <div style={{ display: "flex", flexDirection: "column", padding: "5px 80px", position: "relative", gap: "10px" }}>
          <span style={{ fontSize: "11px", fontWeight: 800, color: "#14F195", letterSpacing: "4px" }}>PUBLIC API</span>
          <div style={{
            display: "flex", flexDirection: "column", padding: "16px 22px",
            borderRadius: "12px", background: "rgba(20,241,149,0.03)",
            border: "1px solid rgba(20,241,149,0.1)", gap: "6px",
          }}>
            <span style={{ fontSize: "15px", fontWeight: 700, color: "#14F195", letterSpacing: "1px" }}>GET /api/v1/scan/&#123;mint&#125;</span>
            <span style={{ fontSize: "13px", color: "#4a4a58" }}>Token-gated programmatic access. Build bots and tools on top of HoldTech data.</span>
          </div>
        </div>

        {/* ═══ LIVE NOW ═══ */}
        <div style={{ display: "flex", flexDirection: "column", padding: "20px 80px", position: "relative", gap: "8px" }}>
          <span style={{ fontSize: "11px", fontWeight: 800, color: "#14F195", letterSpacing: "4px" }}>LIVE NOW</span>
          {[
            "Holder quality scanner — full holderbase autopsy on any CA",
            "Chrome extension — scores on pump.fun · DexScreener · Birdeye · Solscan",
            "Bundler feed dashboard — real-time new token monitoring",
            "Shareable scan cards — one click visual reports",
          ].map((item) => (
            <div key={item} style={{ display: "flex", alignItems: "center", gap: "10px" }}>
              <div style={{ width: "6px", height: "6px", borderRadius: "50%", background: "#14F195", display: "flex", flexShrink: 0, boxShadow: "0 0 8px rgba(20,241,149,0.4)" }} />
              <span style={{ fontSize: "14px", color: "#808090" }}>{item}</span>
            </div>
          ))}
        </div>

        {/* ═══ FOOTER ═══ */}
        <div style={{
          display: "flex", flexDirection: "column", alignItems: "center",
          padding: "15px 80px 45px", position: "relative", gap: "14px", marginTop: "auto",
        }}>
          <div style={{ width: "500px", height: "1px", background: "linear-gradient(90deg, transparent, rgba(153,69,255,0.2), transparent)", display: "flex" }} />
          <span style={{ fontSize: "16px", fontWeight: 900, color: "#ffffff", letterSpacing: "2px" }}>THE PRODUCT IS SHIPPED.</span>
          <div style={{
            display: "flex", padding: "12px 36px",
            background: "linear-gradient(135deg, #9945FF, #7c3aed)",
            borderRadius: "10px", boxShadow: "0 0 30px rgba(153,69,255,0.2)",
          }}>
            <span style={{ fontSize: "16px", fontWeight: 900, color: "white", letterSpacing: "2px" }}>holdtech.fun</span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "6px", marginTop: "4px" }}>
            <img src={logoUrl} width={12} height={12} style={{ borderRadius: "3px", opacity: 0.4 }} />
            <span style={{ fontSize: "10px", color: "#2a2a3a" }}>Solana Token Intelligence · Powered by Helius</span>
          </div>
        </div>

        {/* Bottom accent */}
        <div style={{ position: "absolute", bottom: "24px", left: "24px", right: "24px", height: "3px", borderRadius: "0 0 20px 20px", background: "linear-gradient(90deg, #9945FF, #14F195)", display: "flex" }} />
      </div>
    ),
    { width: 1200, height: 1600 }
  );
}
