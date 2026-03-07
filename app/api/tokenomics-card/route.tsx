import { ImageResponse } from "@vercel/og";

export const runtime = "edge";

export async function GET() {
  const logoUrl = "https://www.holdtech.fun/logo.png";

  return new ImageResponse(
    (
      <div style={{
        width: "1200px", height: "1600px", display: "flex", flexDirection: "column",
        background: "linear-gradient(145deg, #08080f 0%, #0e0b1a 100%)",
        fontFamily: "system-ui, sans-serif", padding: "0", position: "relative", overflow: "hidden",
      }}>
        {/* Top accent bar */}
        <div style={{ width: "100%", height: "4px", background: "linear-gradient(90deg, #9945FF, #14F195)", flexShrink: 0, display: "flex" }} />

        {/* Ambient glow */}
        <div style={{ position: "absolute", top: "100px", left: "-100px", width: "500px", height: "500px", borderRadius: "50%", background: "radial-gradient(circle, rgba(153,69,255,0.08), transparent 70%)", display: "flex" }} />
        <div style={{ position: "absolute", bottom: "100px", right: "-100px", width: "500px", height: "500px", borderRadius: "50%", background: "radial-gradient(circle, rgba(20,241,149,0.05), transparent 70%)", display: "flex" }} />

        {/* Header */}
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", padding: "50px 80px 30px", gap: "12px" }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={logoUrl} width="80" height="80" style={{ borderRadius: "16px" }} alt="" />
          <div style={{ fontSize: "56px", fontWeight: 900, color: "white", letterSpacing: "4px", display: "flex" }}>$HOLDTECH</div>
          <div style={{ fontSize: "18px", fontWeight: 700, color: "#9945FF", letterSpacing: "5px", display: "flex" }}>TOKENOMICS & FLYWHEEL</div>
          <div style={{ width: "600px", height: "1px", background: "linear-gradient(90deg, transparent, #9945FF40, transparent)", display: "flex", marginTop: "8px" }} />
        </div>

        {/* Flywheel */}
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", padding: "10px 80px 20px", gap: "16px" }}>
          <div style={{ fontSize: "13px", fontWeight: 700, color: "#14F195", letterSpacing: "4px", display: "flex", alignSelf: "flex-start" }}>THE FLYWHEEL</div>
          
          <div style={{ display: "flex", alignItems: "center", gap: "0", justifyContent: "center", width: "100%" }}>
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", padding: "14px 24px", background: "#1a153080", borderRadius: "12px", border: "1px solid #9945FF50" }}>
              <div style={{ fontSize: "22px", display: "flex" }}>🔍</div>
              <div style={{ fontSize: "14px", fontWeight: 700, color: "white", display: "flex", marginTop: "4px" }}>Traders scan</div>
            </div>
            <div style={{ fontSize: "24px", color: "#9945FF80", display: "flex", padding: "0 12px" }}>→</div>
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", padding: "14px 24px", background: "#1a102080", borderRadius: "12px", border: "1px solid #f9731650" }}>
              <div style={{ fontSize: "22px", display: "flex" }}>🔥</div>
              <div style={{ fontSize: "14px", fontWeight: 700, color: "#f97316", display: "flex", marginTop: "4px" }}>Tokens burned</div>
            </div>
            <div style={{ fontSize: "24px", color: "#f9731680", display: "flex", padding: "0 12px" }}>→</div>
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", padding: "14px 24px", background: "#0a1a1580", borderRadius: "12px", border: "1px solid #14F19550" }}>
              <div style={{ fontSize: "22px", display: "flex" }}>📉</div>
              <div style={{ fontSize: "14px", fontWeight: 700, color: "#14F195", display: "flex", marginTop: "4px" }}>Supply shrinks</div>
            </div>
            <div style={{ fontSize: "24px", color: "#14F19580", display: "flex", padding: "0 12px" }}>→</div>
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", padding: "14px 24px", background: "#1a153080", borderRadius: "12px", border: "1px solid #b06aff50" }}>
              <div style={{ fontSize: "22px", display: "flex" }}>📈</div>
              <div style={{ fontSize: "14px", fontWeight: 700, color: "#b06aff", display: "flex", marginTop: "4px" }}>Value accrues</div>
            </div>
            <div style={{ fontSize: "24px", color: "#b06aff80", display: "flex", padding: "0 12px" }}>→</div>
            <div style={{ fontSize: "18px", color: "#9945FF", display: "flex", padding: "4px 12px", background: "#9945FF15", borderRadius: "8px", fontWeight: 800 }}>↻</div>
          </div>
          
          <div style={{ fontSize: "15px", color: "#707088", display: "flex" }}>Every deep scan burns tokens permanently. More usage = less supply.</div>
        </div>

        {/* Divider */}
        <div style={{ width: "800px", height: "1px", background: "linear-gradient(90deg, transparent, #9945FF20, transparent)", display: "flex", alignSelf: "center", margin: "10px 0" }} />

        {/* Hold Tiers */}
        <div style={{ display: "flex", flexDirection: "column", padding: "10px 80px", gap: "12px" }}>
          <div style={{ fontSize: "13px", fontWeight: 700, color: "#14F195", letterSpacing: "4px", display: "flex" }}>HOLD TIERS</div>

          {/* FREE */}
          <div style={{ display: "flex", flexDirection: "column", padding: "18px 24px", borderRadius: "14px", background: "#12111e", border: "1px solid #33334480", gap: "8px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
              <div style={{ fontSize: "15px", fontWeight: 800, color: "#666680", letterSpacing: "2px", display: "flex" }}>FREE</div>
              <div style={{ fontSize: "12px", color: "#555568", display: "flex" }}>No tokens required</div>
            </div>
            <div style={{ display: "flex", gap: "20px" }}>
              <div style={{ fontSize: "14px", color: "#808098", display: "flex" }}>• Bundler feed</div>
              <div style={{ fontSize: "14px", color: "#808098", display: "flex" }}>• Single scans</div>
              <div style={{ fontSize: "14px", color: "#808098", display: "flex" }}>• 3 watchlist slots</div>
              <div style={{ fontSize: "14px", color: "#808098", display: "flex" }}>• Rate-limited batch</div>
            </div>
          </div>

          {/* SCOUT */}
          <div style={{ display: "flex", flexDirection: "column", padding: "18px 24px", borderRadius: "14px", background: "#14112280", border: "1px solid #9945FF40", borderLeft: "3px solid #9945FF", gap: "8px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
              <div style={{ fontSize: "15px", fontWeight: 800, color: "#9945FF", letterSpacing: "2px", display: "flex" }}>SCOUT</div>
              <div style={{ fontSize: "12px", fontWeight: 700, color: "#b06aff", background: "#9945FF18", padding: "3px 12px", borderRadius: "6px", display: "flex" }}>Hold 5M</div>
            </div>
            <div style={{ display: "flex", gap: "20px", flexWrap: "wrap" }}>
              <div style={{ fontSize: "14px", color: "#a0a0b8", display: "flex" }}>• 10 watchlist</div>
              <div style={{ fontSize: "14px", color: "#a0a0b8", display: "flex" }}>• Batch 5 tokens</div>
              <div style={{ fontSize: "14px", color: "#a0a0b8", display: "flex" }}>• Scan history</div>
              <div style={{ fontSize: "14px", color: "#a0a0b8", display: "flex" }}>• All group filters</div>
            </div>
          </div>

          {/* OPERATOR */}
          <div style={{ display: "flex", flexDirection: "column", padding: "18px 24px", borderRadius: "14px", background: "#16122880", border: "1px solid #b06aff50", borderLeft: "3px solid #b06aff", gap: "8px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
              <div style={{ fontSize: "15px", fontWeight: 800, color: "#b06aff", letterSpacing: "2px", display: "flex" }}>OPERATOR</div>
              <div style={{ fontSize: "12px", fontWeight: 700, color: "#c084fc", background: "#b06aff18", padding: "3px 12px", borderRadius: "6px", display: "flex" }}>Hold 10M</div>
            </div>
            <div style={{ display: "flex", gap: "20px", flexWrap: "wrap" }}>
              <div style={{ fontSize: "14px", color: "#b0b0c8", display: "flex" }}>• 50 watchlist</div>
              <div style={{ fontSize: "14px", color: "#b0b0c8", display: "flex" }}>• Batch 20 tokens</div>
              <div style={{ fontSize: "14px", color: "#b0b0c8", display: "flex" }}>• Custom bundler groups</div>
              <div style={{ fontSize: "14px", color: "#b0b0c8", display: "flex" }}>• API access</div>
              <div style={{ fontSize: "14px", color: "#b0b0c8", display: "flex" }}>• Priority RPC</div>
            </div>
          </div>

          {/* WHALE */}
          <div style={{ display: "flex", flexDirection: "column", padding: "20px 24px", borderRadius: "14px", background: "#18143080", border: "1px solid #14F19540", borderLeft: "3px solid #14F195", gap: "8px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
              <div style={{ fontSize: "15px", fontWeight: 800, color: "#14F195", letterSpacing: "2px", display: "flex" }}>WHALE</div>
              <div style={{ fontSize: "12px", fontWeight: 700, color: "#14F195", background: "#14F19518", padding: "3px 12px", borderRadius: "6px", display: "flex" }}>Hold 20M</div>
            </div>
            <div style={{ display: "flex", gap: "20px", flexWrap: "wrap" }}>
              <div style={{ fontSize: "14px", color: "#c0c0d8", display: "flex" }}>• 200 watchlist</div>
              <div style={{ fontSize: "14px", color: "#c0c0d8", display: "flex" }}>• Batch 50 tokens</div>
              <div style={{ fontSize: "14px", color: "#c0c0d8", display: "flex" }}>• Raw data export</div>
              <div style={{ fontSize: "14px", color: "#c0c0d8", display: "flex" }}>• Early features</div>
              <div style={{ fontSize: "14px", color: "#c0c0d8", display: "flex" }}>• Unlimited everything</div>
            </div>
          </div>
        </div>

        {/* Divider */}
        <div style={{ width: "800px", height: "1px", background: "linear-gradient(90deg, transparent, #9945FF20, transparent)", display: "flex", alignSelf: "center", margin: "16px 0" }} />

        {/* Live Now */}
        <div style={{ display: "flex", flexDirection: "column", padding: "0 80px", gap: "10px" }}>
          <div style={{ fontSize: "13px", fontWeight: 700, color: "#14F195", letterSpacing: "4px", display: "flex" }}>LIVE NOW</div>
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <div style={{ width: "8px", height: "8px", borderRadius: "50%", background: "#14F195", display: "flex", flexShrink: 0 }} />
            <div style={{ fontSize: "15px", color: "#b0b0c0", display: "flex" }}>Holder quality scanner — paste any CA, full holderbase autopsy</div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <div style={{ width: "8px", height: "8px", borderRadius: "50%", background: "#14F195", display: "flex", flexShrink: 0 }} />
            <div style={{ fontSize: "15px", color: "#b0b0c0", display: "flex" }}>Chrome extension — scores on pump.fun, DexScreener, Birdeye, Solscan</div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <div style={{ width: "8px", height: "8px", borderRadius: "50%", background: "#14F195", display: "flex", flexShrink: 0 }} />
            <div style={{ fontSize: "15px", color: "#b0b0c0", display: "flex" }}>Bundler feed dashboard — real-time new token monitoring</div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <div style={{ width: "8px", height: "8px", borderRadius: "50%", background: "#14F195", display: "flex", flexShrink: 0 }} />
            <div style={{ fontSize: "15px", color: "#b0b0c0", display: "flex" }}>Public API — token-gated programmatic access for developers</div>
          </div>
        </div>

        {/* Footer */}
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", padding: "30px 80px 40px", gap: "16px", marginTop: "auto" }}>
          <div style={{ width: "600px", height: "1px", background: "linear-gradient(90deg, transparent, #9945FF30, transparent)", display: "flex" }} />
          <div style={{ fontSize: "18px", fontWeight: 800, color: "white", letterSpacing: "1px", display: "flex" }}>THE PRODUCT IS SHIPPED. THE FLYWHEEL IS BURNING.</div>
          <div style={{ display: "flex", padding: "12px 40px", background: "linear-gradient(135deg, #9945FF, #7c3aed)", borderRadius: "12px" }}>
            <div style={{ fontSize: "16px", fontWeight: 800, color: "white", letterSpacing: "1px", display: "flex" }}>holdtech.fun</div>
          </div>
        </div>

        {/* Bottom accent bar */}
        <div style={{ width: "100%", height: "4px", background: "linear-gradient(90deg, #9945FF, #14F195)", flexShrink: 0, display: "flex", marginTop: "auto" }} />
      </div>
    ),
    { width: 1200, height: 1600 }
  );
}