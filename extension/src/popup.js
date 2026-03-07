const API = "https://holdtech.fun/api";
const content = document.getElementById("content");
const input = document.getElementById("mint-input");
const btn = document.getElementById("scan-btn");

btn.addEventListener("click", () => scan(input.value.trim()));
input.addEventListener("keydown", (e) => {
  if (e.key === "Enter") scan(input.value.trim());
});

// Check if there's a cached recent scan
chrome.storage.local.get(["lastScan", "lastMint", "lastTime"], (d) => {
  if (d.lastScan && d.lastMint && Date.now() - d.lastTime < 300000) {
    input.value = d.lastMint;
    renderResult(d.lastScan);
  }
});

async function scan(mint) {
  if (!mint || mint.length < 32) return;
  btn.disabled = true;
  btn.textContent = "...";
  content.innerHTML = `<div class="loading"><div class="spinner"></div>Scanning holders...</div>`;

  try {
    // Parallel: analyze + holder count
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

    content.innerHTML = `<div class="loading"><div class="spinner"></div>Generating verdict...</div>`;

    // Get verdict
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

    const result = { analysis, holderCount: countData.count, verdict };
    chrome.storage.local.set({ lastScan: result, lastMint: mint, lastTime: Date.now() });
    renderResult(result);
  } catch (err) {
    content.innerHTML = `<div class="error">❌ ${err.message}</div>`;
  } finally {
    btn.disabled = false;
    btn.textContent = "SCAN";
  }
}

function renderResult(data) {
  const { analysis, holderCount, verdict } = data;
  const w = analysis.wallets || [];
  const supply = analysis.totalSupply || 1;
  const mint = input.value.trim();

  // Compute quick metrics from wallets
  const totalHeld = w.reduce((s, x) => s + (x.balance || 0), 0);
  const top5 = w.slice(0, 5).reduce((s, x) => s + (x.balance || 0), 0);
  const top5Pct = ((top5 / supply) * 100).toFixed(1);
  const freshCount = w.filter((x) => x.walletAgeDays !== undefined && x.walletAgeDays < 7).length;
  const freshPct = w.length > 0 ? ((freshCount / w.length) * 100).toFixed(0) : 0;
  const avgAge = w.length > 0 ? Math.round(w.reduce((s, x) => s + (x.walletAgeDays || 0), 0) / w.length) : 0;

  // Grade from verdict
  const grade = verdict?.grade || "?";
  const score = verdict?.score ?? "—";
  const gradeClass = grade.startsWith("A") ? "grade-a" : grade.startsWith("B") ? "grade-b" : grade.startsWith("C") ? "grade-c" : grade.startsWith("D") ? "grade-d" : "grade-f";
  const summary = verdict?.summary || "";

  content.innerHTML = `
    <div class="result">
      <div class="score-card">
        <div class="score-header">
          <div>
            <div class="token-name">${analysis.tokenSymbol || mint.slice(0, 8)}</div>
            <div style="font-size:10px;color:#888;font-family:monospace;margin-top:2px">${holderCount ? holderCount.toLocaleString() + " holders" : ""}</div>
          </div>
          <div class="grade ${gradeClass}">${grade}</div>
        </div>
        <div class="metrics">
          <div class="metric">
            <div class="metric-label">Score</div>
            <div class="metric-value">${score}/100</div>
          </div>
          <div class="metric">
            <div class="metric-label">Top 5 Conc.</div>
            <div class="metric-value">${top5Pct}%</div>
          </div>
          <div class="metric">
            <div class="metric-label">Fresh Wallets</div>
            <div class="metric-value">${freshPct}%</div>
          </div>
          <div class="metric">
            <div class="metric-label">Avg Age</div>
            <div class="metric-value">${avgAge}d</div>
          </div>
        </div>
        ${summary ? `<div class="verdict-text">${summary}</div>` : ""}
        <a class="view-full" href="https://holdtech.fun?mint=${mint}" target="_blank">View full analysis →</a>
      </div>
    </div>
  `;
}
