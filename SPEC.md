# HolderScope Token-Gated Architecture Spec

## Token: $HOLDTECH

### Tier Thresholds (tunable via env)
| Tier | Holding | Access |
|------|---------|--------|
| Free | 0 | Single scan, rate-limited (5/hr), no history |
| Scout | 10K $HOLDTECH | Watchlist (10 tokens), historical scans (7d), batch scan (5 CAs), basic alerts |
| Operator | 100K $HOLDTECH | Watchlist (50 tokens), full history, batch scan (20 CAs), real-time launch feed, drill alerts, API key (100 req/hr) |
| Whale | 1M $HOLDTECH | Unlimited everything, API (1000 req/hr), raw data export, priority RPC, early features |

Thresholds stored in `config/tiers.ts`, adjustable without redeploy via Upstash Redis override.

---

## Architecture

### 1. Wallet Connection + Auth
```
Frontend: @solana/wallet-adapter-react
Flow: Connect wallet → sign message (nonce) → backend verifies sig → JWT (24h)
JWT payload: { wallet, tier, exp }
Balance check: getTokenAccountsByOwner on every JWT refresh (not cached long)
```

- No database needed initially — tier derived from on-chain balance at auth time
- JWT stored in httpOnly cookie, refreshed on page load
- Tier downgrade is instant (sell tokens → next refresh loses access)

### 2. Rate Limiting (per tier)
```
Upstash Redis rate limiter (@upstash/ratelimit)
Key: `rl:{wallet}:{endpoint}`
Free: 5 scans/hr
Scout: 30 scans/hr  
Operator: 120 scans/hr
Whale: unlimited
Anonymous (no wallet): 3 scans/hr
```

### 3. Watchlist + Alerts

**Storage:** Upstash Redis
```
watchlist:{wallet} → Set of token mints
scan:{mint}:{timestamp} → scan result (compressed JSON, 7d TTL free / 90d Operator)
```

**Alert system:**
- Cron job (every 5 min): re-scan all watched tokens
- Compare current vs last scan: flag if concentration shifts >10%, new bundle cluster detected, holder count drops >20%
- Delivery: webhook URL (user-configured) + in-app notification feed
- Future: Telegram/Discord bot integration

**Data model per scan:**
```ts
interface ScanSnapshot {
  mint: string
  timestamp: number
  holderCount: number
  top5Pct: number
  top10Pct: number
  top20Pct: number
  bundleCount: number
  bundlePct: number
  freshWalletPct: number
  avgWalletAge: number
  verdictScore: number // 0-100
  verdict: string
}
```

### 4. Historical Scans + Trajectory

Every scan result gets stored (if user is Scout+). Frontend shows:
- Line chart: holder quality score over time
- Concentration trend: "top10 went from 80% → 45% in 3 days" (organic distribution)
- Bundle % trend: "bundle activity spiked from 5% → 40% yesterday" (dump incoming)

This is the real alpha — snapshot is noise, trajectory is signal.

### 5. Real-Time Launch Feed (Operator+)

**Infrastructure:**
```
Helius webhook (geyser) → watches pump.fun program
New token event → queue (Upstash QStash)
Worker: auto-scan within 30s of deploy
Result → Redis sorted set (score = quality score)
Frontend: SSE stream or polling /api/feed
```

**Feed UI:**
- Live table of new launches, sorted by quality score
- Columns: token, age, holders, quality score, bundle %, top10 concentration
- Color-coded: green (clean) → red (bundled to hell)
- Click any row → full HolderScope analysis
- Filter: min holders, min score, max bundle %

**Cost estimate:**
- Helius webhook: free tier covers this
- Auto-scan RPC calls: ~8 calls per token (binary search + getTokenAccounts + getTokenSupply)
- At pump.fun's ~2000 deploys/day = ~16K RPC calls/day = well within Helius free tier
- Store last 24h of scans, prune older

### 6. Drill Alerts (Operator+)

**Known bundler database:**
- Every deep-scan that detects bundles → extract funding wallets
- Store in Redis set: `bundlers:{funding_wallet}`
- Over time, build a graph of known bundler wallets
- When a known bundler appears in a new token → flag it

**Alert:**
```
"⚠️ Known bundle cluster (seen in 12 previous tokens) just entered $TOKEN"
"Wallet abc...xyz funded 8 wallets that bought in slot 12345678"
```

This is crowdsourced intelligence — every scan makes the system smarter.

### 7. API Access (Operator+)

```
POST /api/v1/scan
Header: X-API-Key: {key}
Body: { mint: "So1...", depth: "quick" | "deep" }
Response: ScanSnapshot | DeepScanResult

GET /api/v1/feed?minScore=60&limit=50
Response: ScanSnapshot[]

GET /api/v1/history/{mint}?days=30
Response: ScanSnapshot[]
```

API keys generated per wallet, stored in Redis. Rate limited per tier.

### 8. Batch Scanning

```
POST /api/v1/batch
Body: { mints: ["So1...", "So2...", ...] }
Response: { results: ScanSnapshot[], comparison: ComparisonTable }
```

Comparison table ranks tokens by quality score, highlights best/worst metrics.

---

## Build Order (priority)

### Phase 1: Wallet Gate (1-2 sessions)
- [ ] Add wallet adapter to frontend
- [ ] Sign-message auth flow → JWT
- [ ] Tier detection from token balance
- [ ] Rate limiting per tier
- [ ] UI: show current tier, upgrade prompts
- [ ] Gate existing features (scan history behind Scout+)

### Phase 2: Watchlist + History (2-3 sessions)
- [ ] Redis storage for scan results
- [ ] Watchlist CRUD (add/remove tokens)
- [ ] Historical scan view with trajectory charts
- [ ] Cron re-scan of watched tokens (QStash)
- [ ] Basic alert system (in-app notifications)

### Phase 3: Real-Time Feed (2-3 sessions)  
- [ ] Helius webhook for pump.fun deploys
- [ ] Auto-scan worker (QStash)
- [ ] Feed API endpoint
- [ ] Feed UI (live table, filters, color-coded scores)
- [ ] SSE or polling for real-time updates

### Phase 4: Drill Intelligence (1-2 sessions)
- [ ] Bundler wallet database (auto-populated from scans)
- [ ] Cross-reference new scans against known bundlers
- [ ] Drill alert generation
- [ ] Alert delivery (webhook + in-app)

### Phase 5: Public API (1 session)
- [ ] API key generation per wallet
- [ ] Versioned endpoints (/api/v1/*)
- [ ] Rate limiting per key
- [ ] Docs page (/api-docs)

---

## Token Economics

**Supply:** 1B $HOLDTECH
**Platform:** pump.fun (eat our own dogfood — let people scan our own token)

**Allocation:**
- 100% on curve (fair launch, no team allocation visible)
- Bundle buy at deploy for treasury (our standard play)
- Treasury funds: RPC costs, infra, development

**Revenue sinks (future):**
- Premium API could charge in $HOLDTECH (burn on use)
- Watchlist slots purchasable with $HOLDTECH (burn)
- Creates sustained buy pressure beyond speculation

**Narrative:**
"The token that scans itself. Built by degens, for degens. Stop being the drillpig."

---

## Infra Costs (monthly estimate)
| Service | Cost | Notes |
|---------|------|-------|
| Helius RPC | Free → $50 | Free tier = 50K credits/day, enough for Phase 1-2 |
| Upstash Redis | Free → $10 | Free = 10K commands/day, $10 = 500K |
| Upstash QStash | Free | 500 messages/day on free tier |
| Vercel | Free | Hobby tier covers this |
| **Total** | **$0-60/mo** | Scales with usage |

Self-sustaining at ~50 Operator-tier holders (treasury covers infra forever).
