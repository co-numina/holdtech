# 🔬 HOLDTECH

**X-ray any Solana token's holder quality.**

Most tokens look organic on the surface — 500 holders, growing chart, active community. But underneath: 70% are fresh wallets from the same funding source, bundled in the same slot, holding nothing else. The chart is manufactured. The "community" is one person with 50 wallets. You just became their drillpig.

HoldTech fixes this.

🌐 **Website:** [holdtech.fun](https://holdtech.fun)
🧩 **Chrome Extension:** [Chrome Web Store](https://chromewebstore.google.com) *(pending review)*
📜 **Privacy Policy:** [holdtech.fun/privacy](https://holdtech.fun/privacy)

---

## What It Does

Paste any Solana token address → get a complete holder quality analysis in ~15 seconds.

| Feature | Description |
|---------|-------------|
| **Bundle Detection** | Identifies wallets funded from the same source that bought in the same slot |
| **Concentration Analysis** | Top 5/10/20 holder %, Gini coefficient, HHI index |
| **Fresh Wallet Flagging** | Flags wallets created < 7 days ago |
| **Wallet Age Distribution** | Maps when each holder wallet was first active on-chain |
| **SOL Balance Analysis** | Detects bot farms (100 wallets each holding 0.01 SOL) |
| **Funding Cluster Tracing** | Traces wallets back to common funding sources |
| **Buy Timeline** | Visualizes when holders bought — same-slot clusters = coordinated buys |
| **AI Verdict** | Letter grade (A–F), score (0–100), plain-English explanation |

---

## Screenshot

<p align="center">
  <img src="public/logo.png" width="120" alt="HoldTech logo" />
</p>

---

## How It Works

```
Token Address
     │
     ▼
┌─────────────┐     ┌──────────────┐
│  getToken   │────▶│   Helius     │  Fetch top 100 holder accounts
│  Accounts   │     │   RPC        │  with balances
└─────────────┘     └──────────────┘
     │
     ▼
┌─────────────┐     ┌──────────────┐
│  Wallet     │────▶│   Solana     │  First tx timestamp, SOL balance,
│  Profiling  │     │   RPC        │  transaction count, token diversity
└─────────────┘     └──────────────┘
     │
     ▼
┌─────────────┐
│  Analysis   │  Concentration metrics, wallet age distribution,
│  Engine     │  buy timing patterns, funding source clustering
└─────────────┘
     │
     ▼
┌─────────────┐     ┌──────────────┐
│  AI Verdict │────▶│   Claude /   │  Grade + score + natural language
│  Generator  │     │   GPT        │  explanation of holder structure
└─────────────┘     └──────────────┘
     │
     ▼
  Results Dashboard
  (grade, charts, tables, deep scan)
```

---

## Chrome Extension

Two ways to use it:

### Popup Scanner
Click the HoldTech icon on any page → paste a CA → instant grade + key metrics.

### Auto-Inject
Browse normally on supported sites. HoldTech detects the token and injects a score badge automatically.

**Supported sites:**
- pump.fun
- DexScreener (Solana pairs)
- Birdeye
- Solscan
- Defined.fi

SPA-aware — navigates between tokens without reload. Results cached 5 minutes.

### Install (Developer Mode)
```bash
git clone https://github.com/co-numina/holdtech.git
```
1. Open `chrome://extensions`
2. Enable **Developer Mode**
3. Click **Load unpacked** → select the `extension/` folder

---

## Tech Stack

| Layer | Tech |
|-------|------|
| Frontend | Next.js 14, React, TypeScript, Tailwind-inspired inline styles |
| API | Next.js API routes (serverless) |
| RPC | Helius (Solana) |
| AI | Claude / GPT for verdict generation |
| Hosting | Vercel |
| Extension | Manifest V3, vanilla JS |

---

## API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/analyze` | POST | Main analysis — returns top holders with wallet profiles |
| `/api/holder-count` | POST | Binary search holder count (accurate, ~8 RPC calls) |
| `/api/token-info` | POST | Market data via DexScreener + pump.fun |
| `/api/verdict` | POST | AI-generated grade, score, and summary |
| `/api/deep-scan` | POST | Bundle detection, funding clusters, buy timeline |

### Example

```bash
curl -X POST https://holdtech.fun/api/analyze \
  -H "Content-Type: application/json" \
  -d '{"mint": "So11111111111111111111111111111111111111112"}'
```

---

## Metrics Explained

### Concentration
- **Top 5/10/20%** — What percentage of total supply the largest holders control
- **Gini Coefficient** — 0 = perfectly equal distribution, 1 = one wallet holds everything
- **HHI (Herfindahl-Hirschman Index)** — Market concentration metric adapted for holder analysis

### Wallet Quality
- **Fresh Wallets** — Created < 7 days ago. High % = likely manufactured
- **Veteran Wallets** — Active 90+ days. High % = organic holders
- **Low Activity** — < 10 lifetime transactions. Likely single-purpose wallets
- **Avg Wallet Age** — Mean age across all analyzed holders

### Bundle Detection
- **Same-slot buys** — Multiple wallets buying in the exact same Solana slot = coordinated
- **Funding clusters** — Wallets funded from the same parent wallet
- **Bundle count** — Number of distinct bundle groups detected

---

## Comparison

| | Rugcheck | Bubblemaps | HoldTech |
|---|---|---|---|
| Contract safety | ✅ | ❌ | ❌ |
| Visual clusters | ❌ | ✅ | ❌ |
| Individual wallet profiling | ❌ | ❌ | ✅ |
| Funding source tracing | ❌ | Partial | ✅ |
| Bundle detection | ❌ | ❌ | ✅ |
| Buy timing analysis | ❌ | ❌ | ✅ |
| Concentration metrics | ❌ | ❌ | ✅ |
| AI verdict | ❌ | ❌ | ✅ |
| Chrome extension | ❌ | ❌ | ✅ |

---

## Self-Hosting

```bash
git clone https://github.com/co-numina/holdtech.git
cd holdtech
npm install
```

Create `.env.local`:
```
HELIUS_API_KEY=your_helius_key
OPENAI_API_KEY=your_openai_key  # for AI verdicts
```

```bash
npm run dev
```

Open [localhost:3000](http://localhost:3000).

Get a free Helius API key at [helius.dev](https://helius.dev).

---

## $SCOPE

HoldTech is free. $SCOPE holders get the edge.

| Tier | Holding | Access |
|------|---------|--------|
| Free | 0 | Single scans, rate-limited |
| Scout | 5M | Watchlist, historical scans, batch scan, trajectory alerts |
| Operator | 10M | Real-time launch feed, drill alerts, known bundler warnings, API access |
| Whale | 50M | Unlimited everything, raw data export, priority RPC, early features |

**Coming soon:**
- 📡 **Real-time feed** — New pump.fun deploys auto-scanned within 30 seconds
- 🔩 **Drill intelligence** — Known bundler database, crowdsourced from every scan
- 📈 **Trajectory tracking** — Holder quality over time, not just snapshots

CA dropping soon.

---

## Contributing

Open source. PRs welcome.

```bash
git clone https://github.com/co-numina/holdtech.git
cd holdtech
npm install
npm run dev
```

---

## License

MIT

---

<p align="center">
  <strong>Stop being the drillpig.</strong><br>
  <a href="https://holdtech.fun">holdtech.fun</a> · <a href="https://x.com/latebuild">@latebuild</a> · <a href="https://github.com/co-numina/holdtech">GitHub</a>
</p>
