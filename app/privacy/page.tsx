export default function Privacy() {
  return (
    <div style={{ maxWidth: "640px", margin: "0 auto", padding: "48px 24px", fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif", color: "#1a1a2e" }}>
      <div style={{ marginBottom: "32px" }}>
        <a href="/" style={{ fontFamily: "'Courier New', monospace", fontSize: "14px", fontWeight: 800, background: "linear-gradient(135deg, #9945FF, #14F195)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", textDecoration: "none" }}>HOLDTECH</a>
      </div>

      <h1 style={{ fontSize: "24px", fontWeight: 700, marginBottom: "8px" }}>Privacy Policy</h1>
      <p style={{ fontSize: "13px", color: "#888", marginBottom: "32px" }}>Last updated: March 7, 2025</p>

      <div style={{ fontSize: "14px", lineHeight: 1.8, color: "#444" }}>
        <h2 style={{ fontSize: "16px", fontWeight: 700, color: "#1a1a2e", marginTop: "24px", marginBottom: "8px" }}>Overview</h2>
        <p>HoldTech is a Solana token holder quality analysis tool. We do not collect, store, or sell any personal data. This policy covers both the website (holder-quality.vercel.app) and the HoldTech Chrome extension.</p>

        <h2 style={{ fontSize: "16px", fontWeight: 700, color: "#1a1a2e", marginTop: "24px", marginBottom: "8px" }}>Data We Collect</h2>
        <p><strong>None.</strong> We do not collect personal information, browsing history, IP addresses, cookies, or analytics data of any kind.</p>

        <h2 style={{ fontSize: "16px", fontWeight: 700, color: "#1a1a2e", marginTop: "24px", marginBottom: "8px" }}>How the Tool Works</h2>
        <p>When you submit a Solana token address for analysis, the address is sent to our API to fetch on-chain holder data from public Solana RPC endpoints. The analysis is performed server-side and returned to your browser. We do not log which tokens are scanned or who scanned them.</p>

        <h2 style={{ fontSize: "16px", fontWeight: 700, color: "#1a1a2e", marginTop: "24px", marginBottom: "8px" }}>Chrome Extension</h2>
        <p>The HoldTech Chrome extension:</p>
        <ul style={{ marginLeft: "20px", marginTop: "8px" }}>
          <li>Uses the <strong>storage</strong> permission solely to cache recent scan results locally on your device for up to 5 minutes</li>
          <li>Communicates only with the HoldTech API (holder-quality.vercel.app) to fetch analysis results</li>
          <li>Does not access, read, or modify any page content beyond injecting the HoldTech score badge on supported sites</li>
          <li>Does not execute any remote code — all scripts are bundled locally</li>
          <li>Does not collect or transmit any personal data, browsing history, or credentials</li>
        </ul>

        <h2 style={{ fontSize: "16px", fontWeight: 700, color: "#1a1a2e", marginTop: "24px", marginBottom: "8px" }}>Third-Party Services</h2>
        <p>We use Helius RPC to query public Solana blockchain data. No personal information is shared with any third party. All data queried is publicly available on-chain.</p>

        <h2 style={{ fontSize: "16px", fontWeight: 700, color: "#1a1a2e", marginTop: "24px", marginBottom: "8px" }}>Data Storage</h2>
        <p>We do not operate a database or store any user data server-side. The Chrome extension caches scan results in your browser&apos;s local storage, which you can clear at any time by removing the extension.</p>

        <h2 style={{ fontSize: "16px", fontWeight: 700, color: "#1a1a2e", marginTop: "24px", marginBottom: "8px" }}>Open Source</h2>
        <p>HoldTech is fully open source. You can audit the complete source code at <a href="https://github.com/co-numina/holdtech" target="_blank" rel="noopener" style={{ color: "#9945FF" }}>github.com/co-numina/holdtech</a>.</p>

        <h2 style={{ fontSize: "16px", fontWeight: 700, color: "#1a1a2e", marginTop: "24px", marginBottom: "8px" }}>Contact</h2>
        <p>Questions about this policy: <a href="mailto:latebuild@mailfence.com" style={{ color: "#9945FF" }}>latebuild@mailfence.com</a></p>
      </div>
    </div>
  );
}
