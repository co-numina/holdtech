// HoldTech Content Script
// Detects Solana token addresses on supported pages and injects quality badges

const API = "https://holdtech.fun/api";
const CACHE_TTL = 300000; // 5 min
const cache = {};

function getHost() {
  const h = location.hostname.replace("www.", "");
  if (h.includes("pump.fun")) return "pump";
  if (h.includes("dexscreener.com")) return "dexscreener";
  if (h.includes("birdeye.so")) return "birdeye";
  if (h.includes("solscan.io")) return "solscan";
  if (h.includes("defined.fi")) return "defined";
  return null;
}

function extractMint() {
  const host = getHost();
  const path = location.pathname;

  if (host === "pump") {
    // pump.fun/coin/MINT or pump.fun/MINT
    const match = path.match(/\/(?:coin\/)?([A-Za-z0-9]{32,50})/);
    return match ? match[1] : null;
  }
  if (host === "dexscreener") {
    // /solana/PAIR — need to get token from page
    const match = path.match(/\/solana\/([A-Za-z0-9]{32,50})/);
    return match ? match[1] : null;
  }
  if (host === "birdeye") {
    // /token/MINT
    const match = path.match(/\/token\/([A-Za-z0-9]{32,50})/);
    return match ? match[1] : null;
  }
  if (host === "solscan") {
    const match = path.match(/\/token\/([A-Za-z0-9]{32,50})/);
    return match ? match[1] : null;
  }
  if (host === "defined") {
    const match = path.match(/\/sol\/([A-Za-z0-9]{32,50})/);
    return match ? match[1] : null;
  }
  return null;
}

function gradeColor(grade) {
  if (!grade) return "#888";
  if (grade.startsWith("A")) return "#14F195";
  if (grade.startsWith("B")) return "#4ade80";
  if (grade.startsWith("C")) return "#eab308";
  if (grade.startsWith("D")) return "#f97316";
  return "#ef4444";
}

function gradeBg(grade) {
  if (!grade) return "rgba(136,136,136,0.1)";
  if (grade.startsWith("A")) return "rgba(20,241,149,0.12)";
  if (grade.startsWith("B")) return "rgba(74,222,128,0.12)";
  if (grade.startsWith("C")) return "rgba(234,179,8,0.12)";
  if (grade.startsWith("D")) return "rgba(249,115,22,0.12)";
  return "rgba(239,68,68,0.12)";
}

function createBadge(data) {
  const { grade, score, holderCount, top5Pct, freshPct } = data;
  const badge = document.createElement("div");
  badge.id = "holdtech-badge";
  badge.innerHTML = `
    <div class="hs-badge-inner">
      <div class="hs-badge-header">
        <span class="hs-logo">🔬 HOLDTECH</span>
        <span class="hs-grade" style="background:${gradeBg(grade)};color:${gradeColor(grade)}">${grade || "?"}</span>
      </div>
      <div class="hs-metrics">
        <div class="hs-metric"><span class="hs-label">Score</span><span class="hs-val">${score ?? "—"}/100</span></div>
        <div class="hs-metric"><span class="hs-label">Holders</span><span class="hs-val">${holderCount ? holderCount.toLocaleString() : "—"}</span></div>
        <div class="hs-metric"><span class="hs-label">Top 5</span><span class="hs-val">${top5Pct ?? "—"}%</span></div>
        <div class="hs-metric"><span class="hs-label">Fresh</span><span class="hs-val">${freshPct ?? "—"}%</span></div>
      </div>
      <a class="hs-full-link" href="https://holdtech.fun?mint=${data.mint}" target="_blank">Full analysis →</a>
    </div>
  `;
  return badge;
}

function createLoading() {
  const el = document.createElement("div");
  el.id = "holdtech-badge";
  el.innerHTML = `
    <div class="hs-badge-inner">
      <div class="hs-badge-header">
        <span class="hs-logo">🔬 HOLDTECH</span>
        <span class="hs-scanning">scanning...</span>
      </div>
    </div>
  `;
  return el;
}

async function scanToken(mint) {
  if (cache[mint] && Date.now() - cache[mint].time < CACHE_TTL) {
    return cache[mint].data;
  }

  const [analyzeRes, countRes] = await Promise.all([
    fetch(`${API}/analyze`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ mint }),
    }),
    fetch(`${API}/holder-count`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ mint }),
    }),
  ]);

  if (!analyzeRes.ok) throw new Error("Analysis failed");
  const analysis = await analyzeRes.json();
  const countData = countRes.ok ? await countRes.json() : { count: null };

  const verdictRes = await fetch(`${API}/verdict`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      wallets: analysis.wallets,
      totalSupply: analysis.totalSupply,
      holderCount: countData.count,
    }),
  });
  const verdict = verdictRes.ok ? await verdictRes.json() : null;

  const w = analysis.wallets || [];
  const supply = analysis.totalSupply || 1;
  const top5 = w.slice(0, 5).reduce((s, x) => s + (x.balance || 0), 0);

  const result = {
    mint,
    grade: verdict?.grade,
    score: verdict?.score,
    holderCount: countData.count,
    top5Pct: ((top5 / supply) * 100).toFixed(1),
    freshPct: w.length > 0 ? ((w.filter((x) => x.walletAgeDays !== undefined && x.walletAgeDays < 7).length / w.length) * 100).toFixed(0) : "—",
  };

  cache[mint] = { data: result, time: Date.now() };
  return result;
}

async function inject() {
  const mint = extractMint();
  if (!mint) return;

  // Don't double-inject
  if (document.getElementById("holdtech-badge")) return;

  // Show loading badge
  document.body.appendChild(createLoading());

  try {
    const data = await scanToken(mint);
    const existing = document.getElementById("holdtech-badge");
    if (existing) existing.remove();
    document.body.appendChild(createBadge(data));
  } catch (err) {
    const existing = document.getElementById("holdtech-badge");
    if (existing) existing.remove();
    // Silent fail — don't annoy the user
    console.log("[HoldTech] scan failed:", err.message);
  }
}

// Run on load
inject();

// Watch for SPA navigation (pump.fun, dexscreener are SPAs)
let lastUrl = location.href;
const observer = new MutationObserver(() => {
  if (location.href !== lastUrl) {
    lastUrl = location.href;
    const existing = document.getElementById("holdtech-badge");
    if (existing) existing.remove();
    setTimeout(inject, 1500); // wait for page to settle
  }
});
observer.observe(document.body, { childList: true, subtree: true });
