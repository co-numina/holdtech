import { ImageResponse } from "@vercel/og";

export const runtime = "edge";

export async function GET() {
  const logoUrl = "https://www.holdtech.fun/logo.png";

  return new ImageResponse(
    (
      <div style={{
        width: "1200px", height: "1800px", display: "flex", flexDirection: "column",
        background: "linear-gradient(160deg, #08080f 0%, #0e0b1a 100%)",
        fontFamily: "system-ui, -apple-system, sans-serif", padding: "0", position: "relative", overflow: "hidden",
      }}>
        {/* Top accent bar */}
        <div style={{ width: "100%", height: "5px", background: "linear-gradient(90deg, #9945FF, #14F195)", flexShrink: 0, display: "flex" }} />

        {/* Glow effects */}
        <div style={{ position: "absolute", top: "100px", left: "50px", width: "400px", height: "400px", borderRadius: "50%", background: "radial-gradient(circle, rgba(153,69,255,0.08) 0%, transparent 70%)", display: "flex" }} />
        <div style={{ position: "absolute", bottom: "100px", right: "50px", width: "500px", height: "500px", borderRadius: "50%", background: "radial-gradient(circle, rgba(20,241,149,0.05) 0%, transparent 70%)", display: "flex" }} />

        {/* Header */}
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", padding: "50px 0 30px", gap: "16px" }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={logoUrl} width="90" height="90" style={{ borderRadius: "20px" }} alt="" />
          <div style={{ display: "flex", fontSize: "64px", fontWeight: 900, color: "white", letterSpacing: "6px" }}>$HOLDTECH</div>
          <div style={{ display: "flex", fontSize: "18px", fontWeight: 700, letterSpacing: "5px", background: "linear-gradient(90deg, #9945FF, #14F195)", backgroundClip: "text", color: "transparent" }}>TOKENOMICS & FLYWHEEL</div>
        </div>

        {/* Divider */}
        <div style={{ width: "700px", height: "1px", background: "linear-gradient(90deg, transparent, rgba(153,69,255,0.3), transparent)", margin: "0 auto", display: "flex" }} />

        {/* Flywheel section */}
        <div style={{ display: "flex", flexDirection: "column", padding: "35px 100px 25px", gap: "20px" }}>
          <div style={{ display: "flex", fontSize: "14px", fontWeight: 700, color: "#14F195", letterSpacing: "4px" }}>THE FLYWHEEL</div>
          
          {/* Flywheel boxes */}
          <div style={{ display: "flex", justifyContent: "center", gap: "16px", flexWrap: "wrap" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "center", padding: "14px 28px", borderRadius: "12px", background: "rgba(153,69,255,0.08)", border: "1px solid rgba(153,69,255,0.25)", fontSize: "16px", fontWeight: 700, color: "white" }}>
              🔍 Traders scan tokens
            </div>
            <div style={{ display: "flex", alignItems: "center", fontSize: "24px", color: "#9945FF" }}>→</div>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "center", padding: "14px 28px", borderRadius: "12px", background: "rgba(249,115,22,0.08)", border: "1px solid rgba(249,115,22,0.25)", fontSize: "16px", fontWeight: 700, color: "#f97316" }}>
              🔥 $HOLDTECH burned
            </div>
            <div style={{ display: "flex", alignItems: "center", fontSize: "24px", color: "#f97316" }}>→</div>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "center", padding: "14px 28px", borderRadius: "12px", background: "rgba(20,241,149,0.08)", border: "1px solid rgba(20,241,149,0.25)", fontSize: "16px", fontWeight: 700, color: "#14F195" }}>
              📉 Supply decreases
            </div>
            <div style={{ display: "flex", alignItems: "center", fontSize: "24px", color: "#14F195" }}>→</div>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "center", padding: "14px 28px", borderRadius: "12px", background: "rgba(176,106,255,0.08)", border: "1px solid rgba(176,106,255,0.25)", fontSize: "16px", fontWeight: 700, color: "#b06aff" }}>
              📈 Value accrues
            </div>
            <div style={{ display: "flex", alignItems: "center", fontSize: "24px", color: "#b06aff" }}>→ 🔁</div>
          </div>

          <div style={{ display: "flex", justifyContent: "center", fontSize: "15px", color: "#606078" }}>
            Every deep scan burns tokens permanently. More usage = less supply. Product drives price.
          </div>
        </div>

        {/* Divider */}
        <div style={{ width: "700px", height: "1px", background: "linear-gradient(90deg, transparent, rgba(153,69,255,0.2), transparent)", margin: "5px auto", display: "flex" }} />

        {/* Hold Tiers */}
        <div style={{ display: "flex", flexDirection: "column", padding: "25px 80px", gap: "14px" }}>
          <div style={{ display: "flex", fontSize: "14px", fontWeight: 700, color: "#14F195", letterSpacing: "4px" }}>HOLD TIERS</div>

          {/* FREE */}
          <div style={{ display: "flex", flexDirection: "column", padding: "18px 24px", borderRadius: "16px", background: "rgba(26,26,46,0.7)", border: "1px solid rgba(68,68,102,0.5)", gap: "8px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
              <div style={{ display: "flex", fontSize: "13px", fontWeight: 700, color: "#666680", letterSpacing: "3px" }}>FREE</div>
            </div>
            <div style={{ display: "flex", fontSize: "14px", color: "#808098", gap: "24px" }}>
              <span>• Bundler feed</span>
              <span>• Single scans</span>
              <span>• 3 watchlist slots</span>
              <span>• Rate-limited batch</span>
            </div>
          </div>

          {/* SCOUT */}
          <div style={{ display: "flex", flexDirection: "column", padding: "18px 24px", borderRadius: "16px", background: "rgba(26,21,48,0.7)", border: "1px solid rgba(153,69,255,0.3)", gap: "8px", borderLeft: "4px solid #9945FF" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
              <div style={{ display: "flex", fontSize: "13px", fontWeight: 700, color: "#9945FF", letterSpacing: "3px" }}>SCOUT</div>
              <div style={{ display: "flex", padding: "3px 14px", borderRadius: "6px", background: "rgba(153,69,255,0.12)", fontSize: "13px", fontWeight: 700, color: "#b06aff" }}>Hold 5M</div>
            </div>
            <div style={{ display: "flex", fontSize: "14px", color: "#a0a0b8", gap: "24px", flexWrap: "wrap" }}>
              <span>• 10 watchlist slots</span>
              <span>• Batch 5 tokens</span>
              <span>• Scan history</span>
              <span>• All group filters</span>
            </div>
          </div>

          {/* OPERATOR */}
          <div style={{ display: "flex", flexDirection: "column", padding: "18px 24px", borderRadius: "16px", background: "rgba(30,21,53,0.7)", border: "1px solid rgba(176,106,255,0.3)", gap: "8px", borderLeft: "4px solid #b06aff" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
              <div style={{ display: "flex", fontSize: "13px", fontWeight: 700, color: "#b06aff", letterSpacing: "3px" }}>OPERATOR</div>
              <div style={{ display: "flex", padding: "3px 14px", borderRadius: "6px", background: "rgba(176,106,255,0.12)", fontSize: "13px", fontWeight: 700, color: "#c084fc" }}>Hold 10M</div>
            </div>
            <div style={{ display: "flex", fontSize: "14px", color: "#b0b0c8", gap: "24px", flexWrap: "wrap" }}>
              <span>• 50 watchlist slots</span>
              <span>• Batch 20 tokens</span>
              <span>• Custom bundler groups</span>
              <span>• API access</span>
              <span>• Priority RPC</span>
            </div>
          </div>

          {/* WHALE */}
          <div style={{ display: "flex", flexDirection: "column", padding: "18px 24px", borderRadius: "16px", background: "rgba(34,24,64,0.7)", border: "1.5px solid rgba(153,69,255,0.4)", gap: "8px", borderLeft: "4px solid #14F195" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
              <div style={{ display: "flex", fontSize: "13px", fontWeight: 700, color: "#14F195", letterSpacing: "3px" }}>WHALE</div>
              <div style={{ display: "flex", padding: "3px 14px", borderRadius: "6px", background: "rgba(20,241,149,0.1)", fontSize: "13px", fontWeight: 700, color: "#14F195" }}>Hold 20M</div>
            </div>
            <div style={{ display: "flex", fontSize: "14px", color: "#c0c0d8", gap: "24px", flexWrap: "wrap" }}>
              <span>• 200 watchlist slots</span>
              <span>• Batch 50 tokens</span>
              <span>• Raw data export</span>
              <span>• Early features</span>
              <span>• Unlimited everything</span>
            </div>
          </div>
        </div>

        {/* Divider */}
        <div style={{ width: "700px", height: "1px", background: "linear-gradient(90deg, transparent, rgba(153,69,255,0.2), transparent)", margin: "5px auto", display: "flex" }} />

        {/* Live Now */}
        <div style={{ display: "flex", flexDirection: "column", padding: "25px 100px", gap: "12px" }}>
          <div style={{ display: "flex", fontSize: "14px", fontWeight: 700, color: "#14F195", letterSpacing: "4px" }}>LIVE NOW</div>
          <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "10px", fontSize: "16px", color: "#b0b0c8" }}>
              <div style={{ width: "8px", height: "8px", borderRadius: "50%", background: "#14F195", display: "flex" }} />
              Holder quality scanner — paste any CA, full holderbase autopsy
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: "10px", fontSize: "16px", color: "#b0b0c8" }}>
              <div style={{ width: "8px", height: "8px", borderRadius: "50%", background: "#14F195", display: "flex" }} />
              Chrome extension — scores on pump.fun, DexScreener, Birdeye, Solscan
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: "10px", fontSize: "16px", color: "#b0b0c8" }}>
              <div style={{ width: "8px", height: "8px", borderRadius: "50%", background: "#14F195", display: "flex" }} />
              Bundler feed dashboard — real-time new token monitoring
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: "10px", fontSize: "16px", color: "#b0b0c8" }}>
              <div style={{ width: "8px", height: "8px", borderRadius: "50%", background: "#14F195", display: "flex" }} />
              Shareable scan cards — one click visual reports
            </div>
          </div>
        </div>

        {/* Footer */}
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", padding: "20px 0 40px", gap: "18px", marginTop: "auto" }}>
          <div style={{ display: "flex", fontSize: "20px", fontWeight: 800, color: "white", letterSpacing: "1px" }}>
            THE PRODUCT IS SHIPPED. THE FLYWHEEL IS BURNING. 🛡️
          </div>
          <div style={{ display: "flex", padding: "12px 40px", borderRadius: "12px", background: "linear-gradient(135deg, #9945FF, #6d28d9)", fontSize: "18px", fontWeight: 800, color: "white", letterSpacing: "1px" }}>
            holdtech.fun
          </div>
        </div>

        {/* Bottom accent bar */}
        <div style={{ width: "100%", height: "5px", background: "linear-gradient(90deg, #9945FF, #14F195)", flexShrink: 0, display: "flex", marginTop: "auto" }} />
      </div>
    ),
    {
      width: 1200,
      height: 1800,
    }
  );
}