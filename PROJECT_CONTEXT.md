# Pocket Trade — Project Context

> **READ THIS FIRST** at the start of every new Claude session. This file is the single source of truth — keep it current. After any major decision, file change, or block completion, update this file and commit it.

## REPO

- GitHub: https://github.com/ttradez/pocket-trade (private)
- Local: `C:\Users\benti\trading-app`
- Owner: `ttradez`

## MULTI-CLAUDE ORCHESTRATION

Three Claude sessions are in active use. They cannot talk to each other directly — the user is the bridge.

| Role | Session | Best for |
|---|---|---|
| Director | Claude Remote (browser claude.ai) | Decisions, prompts, Firebase walkthrough (screenshots), planning |
| Implementer | Claude Code on the web (claude.ai/code, repo `ttradez/pocket-trade`) | Spec docs, code edits, repo commits |
| Local | Claude Code in user's terminal | Local file ops, machine-specific tasks |

PROJECT_CONTEXT.md is the shared state. Anything important must be written here and committed so all sessions see it on next read.

## SOCIAL

- 3-tab leaderboard: Global / Monthly / Weekly + Tournament tab during active tournaments
- Public profiles: rank, P&L, win rate, profit factor, total trades, badges, recent public trades
- Trade sharing: post closed trades to public feed
- Private friend-group leaderboards
- No follow/feed-of-followed-users in v1

## DASHBOARD

Shows: rank badge, total trades, win rate, profit factor, expectancy, avg win, avg loss, R:R, max drawdown, equity curve, best/worst trade, full trade journal with notes + filtering, tournament history.

## TRADE JOURNAL

Auto-popup on trade close. Auto-fills: symbol, direction, entry/exit, size, SL/TP, P&L, R-multiple, session date (revealed only here), news snapshot. User adds optional notes.

## BRANDING — locked 2026-05-12

- **Backgrounds: pure black `#000000`** (locked — no navy, no dark blue). Card surface `#0F0F0F` for subtle lift on cards where black-on-black would lose depth; default border `#1F1F1F`.
- **Text:** white `#FFFFFF`, **bold default** (`fontWeight: 700`). Secondary text `#9CA3AF`, tertiary `#6B7280`.
- **Font:** clean modern sans-serif — **Inter preferred** (not yet bundled via `expo-font`; once loaded, swap `font.sans` / `font.sansBold` in `src/theme/index.ts`), **system fallback** otherwise (San Francisco on iOS, Roboto on Android).
- **Accents (semantic):** gold `#FFB800`, gain green `#00D395`, loss red `#FF4757`. Used for buttons, BUY/SELL, P&L, candle up/down (`DEFAULT_CHART_THEME`).
- **Monospace** (`SpaceMono-Regular` / `-Bold`) for ALL numbers: prices, P&L, percentages, balances.
- Vibe: prop-firm-meets-Robinhood
- Logo: placeholder "PT" gold on dark with candlestick

## LEGAL

- Splash screen disclaimer on first launch (must dismiss)
- ToS and Privacy Policy as Markdown files in `legal/` (not yet drafted)
- LEGAL_DISCLAIMER.md notes lawyer review needed before publishing

## BUILD STATUS

### COMPLETE (16 master-spec blocks)
- Backend: db.py, main.py (FastAPI + all endpoints), data_pipeline (symbol_map, fetch_stooq → yfinance, fetch_kaggle_intraday, data_ingest, fetch_news scaffold)
- Frontend: authStore, sessionStore, api service, iapService, TradingChart, OrderPanel, TradingScreen, DashboardScreen, LeaderboardScreen, DisclaimerScreen, App.tsx, app.json rebranded
- SETUP.md created
- PROJECT_CONTEXT.md created

### VERIFIED (7 integrity checks all passed)
1. yfinance fetch — works, all 14 symbols, real OHLC confirmed
2. Advance endpoint — server-computed bar_index, no real timestamps to client, GET /sessions/{id} resume endpoint
3. Tournament score — exact spec match (final_balance × min(1.5, profit_factor/2) × min(1.5, win_rate/0.5) × max(0.5, 1−max_drawdown_pct); zero if PF≤1.0 OR WR<0.30)
4. Rank recalc — fires on every trade close, rolling 200 trades, exact thresholds (Gambler/Paper Hands/Sniper/Inside Trader/Market Maker)
5. Multiple positions — JSON array, all positions checked per bar for SL/TP
6. News snapshot — honest empty array, TODO wire real source
7. State persistence — AsyncStorage + server rebuild on mount

### VERIFIED CLEAN (previously pending)
- symbol_map.py renames via STOOQ_MAP — actual files in `backend/data/daily/`: SPX.csv, NDX.csv, DJI.csv, DAX.csv, FTSE.csv, N225.csv, ES.csv, NQ.csv, YM.csv, CL.csv, GC.csv, SI.csv, NG.csv, ZB.csv. No `ES=F.csv` filenames anywhere.
- fetch_kaggle_intraday.py wired correctly: KAGGLE_MAP only has clean_SPY.csv→ES, clean_QQQ.csv→NQ; resamples to 5m/15m/30m/1h/4h.

### IN FLIGHT
- **Drawing tools: DEPRECATED — TradingView Advanced Charts application SUBMITTED 2026-05-12.** The custom SVG drawing system is retired in favor of TradingView's library. **Awaiting 3–10 business day approval response.**

  **Application details (for reference if TradingView reaches out):**
  - Product: **TradingView Advanced Charts** (private repo access)
  - Signatory: **Zachary James Titus**
  - Contact email: **ben@sitesbyben.ca**
  - Website submitted: **https://pockettrade.sitesbyben.ca** — must load when TradingView reviews. User is building the landing page on Lovable and will deploy it to that subdomain.

  Last working snapshot of the custom system is at the local git tag **`pre-charting-library-switch`**. Backup of the pre-reset implementations remains at **`drawings-before-reset`**. DO NOT delete either tag.

  Research / planning notes will live in **`docs/DRAWING_LIBRARY_RESEARCH.md`** (user is adding).

  **While waiting for approval:** pivot to OTHER features — Lovable landing page deploy, news (Forex Factory), trade card, Firebase, ToS / Privacy, logo, etc. No drawing-related work until the library is in hand.
- **Onboarding rebuild — IN PROGRESS (2026-05-12).** Replacing the current `AccountSetup` / `Login` / `FeatureTour` flow with a 12-screen sequence informed by retention research. Source of truth: **`docs/ONBOARDING_RETENTION_RESEARCH.md`** (user is adding). Building one screen at a time, smoke-testing each before moving on.
  - **Screens 1–11 shipped.** Splash → Premise → Archetype quiz (5Q + reveal) → Identity (5 cards) → Experience (4 cards) → Account size (5 preset tiers, $50K default) → Trader name (handle + display + rank-banner preview) → Daily commitment (Light/Steady/Pro, Steady default) → First Trade (activation event) → Rank reveal (5-banner ladder + progress bar) → **Save your progress (auth UI shell)**. Screen 12 (welcome + notifications opt-in) is the next prompt.
  - **First Trade chart approach:** built `src/components/onboarding/OnboardingMiniChart.tsx` — a focused ~150-line SVG candlestick component — instead of plumbing the production `TradingChart` through `sessionStore` / `positions` / `currentPrice` / backend endpoints. Rationale: TradingChart is a heavy WebView with deep state couplings; an onboarding-only flow with a locked 33-bar dataset and almost every interactive affordance disabled would have spent more effort wiring + disabling than the inheritance was worth. The chart will be replaced wholesale by TradingView Advanced Charts when the application is approved anyway, so any onboarding-specific plumbing on top of the current chart would have been thrown away.
  - **Auth is MOCKED on screen 11.** Tapping Continue with Apple / Google / Email runs a 500 ms spinner, writes `{ authMethod: 'mock-apple' | 'mock-google' | 'mock-email', isAuthed: true }` to `onboardingStore`, and advances. **No real Firebase calls happen yet.** Real Firebase + Apple/Google SSO + email-password form is a follow-up prompt — UI shell is final, just the wire-up is deferred.
  - **Dev flag:** `FORCE_ONBOARDING_FLOW` at the top of `App.tsx` (currently `true`). When true, the app skips the loading splash / disclaimer / auth gates entirely and boots straight into the onboarding stack. Flip to `false` before shipping. Original `AccountSetup` / `Login` / `FeatureTour` / disclaimer wiring is untouched.
- **Firebase setup** — bundle ID `com.pockettrade.app` (iOS + Android), Expo managed workflow, pure-JS firebase v12.12.1 (NOT @react-native-firebase). Six EXPO_PUBLIC_FIREBASE_* env vars in `.env` still empty awaiting console values. Walkthrough being conducted in Claude Remote with screenshots.

### ABANDONED
- **KLineChart Pro spike** (`feature/klinechart-spike` branch, latest commit `3f5f458`) — 7 iterations attempting to swap our custom-SVG drawing system for the KLineChart Pro library inside the WebView. Spike was preserved but abandoned because: (a) couldn't get a clean simultaneous state — fixing pan/zoom broke layout, fixing layout reintroduced overlays, etc.; (b) couldn't determine which API path was usable without device-side log access; (c) custom SVG drawing system on master already worked in earlier user testing. Branch is parked as fallback if we revisit; do NOT delete. Reason for keeping: research artifact (locale, theme, CDN-via-WebView pattern, defensive path-A/B fallbacks, in-WebView debug log overlay) might inform a future swap.

### NOT YET BUILT
- Real news data source (FRED is macro-only and not useful per-trade — panel hidden in v1, news_snapshot column kept in trades table for future)
- Drafted ToS / Privacy Policy markdown
- Logo SVG placeholder
- Beta test plan

## USER BLOCKERS — TODO BEFORE LAUNCH

1. Firebase project (in flight via Claude Remote walkthrough)
2. Railway backend deployment, paste URL into `.env` as `EXPO_PUBLIC_API_URL`
3. Kaggle account + API token to `~/.kaggle/kaggle.json`, then run data_ingest.py
4. AdMob account, swap test IDs for real ones in `app.json` + `src/services/adService.ts`
5. Apple Developer Program ($99/yr) for iOS publish
6. Google Play Console ($25 one-time) for Android publish

## LOCKED DECISIONS

### Product
- Free + ads (6-min interstitials) + $5 CAD remove-ads IAP per device
- $25k/$50k/$75k/$100k account picks
- 2 accounts max (practice + tournament)
- Random-day-at-market-open with timezone picker
- Bar-by-bar manual + auto-play 1x–10x
- All order types, multiple positions, no commissions/spreads/slippage
- News panel hidden in v1; news_snapshot column stays in trades table
- Trade journal auto-popup with auto-attach news (when wired)
- Public profiles + trade feed + private group leaderboards
- 5-tier rank system (Gambler → Paper Hands → Sniper → Inside Trader → Market Maker)
- Monthly tournaments, top 3, score with consistency multiplier
- Dark theme + gold accent
- Splash disclaimer on first launch

### Data sources
- Daily/weekly: yfinance via fetch_stooq.py (all 14 symbols)
- Intraday: Kaggle CC0 dataset for ES/NQ 1-min, resampled to 5m/15m/30m/1h/4h. yfinance only has 7-day intraday window so kaggle stays.

### Drawing tools (Block 17)
- Per-session only, wiped on session end
- Canvas (not SVG) inside WebView, manual hit-test
- Toolbar in React Native (not WebView)
- No snap-to-OHLC in v1
- Pure client-side, no backend changes
- Gesture forwarding: Option A (always-on canvas, manual pan via setVisibleLogicalRange, two-pointer pinch math, setPointerCapture on pointerdown). Option B (three-layer router) rejected — duplicates hit-test logic, can't reassign gesture mid-stroke.

## NEXT STEPS

1. Finish Firebase walkthrough in Claude Remote → paste 6 config values into `.env`
2. Implement Block 17 (spec locked).
3. Deploy backend to Railway → paste URL into `.env`
4. Get Kaggle API token → run `python backend/data_pipeline/data_ingest.py` to load CSVs into SQLite
5. End-to-end test: signup → start session → trade → journal → leaderboard
6. Draft ToS / Privacy Policy
7. Logo SVG
8. Beta plan
9. Apple Developer + Google Play Console accounts

## HOW TO KEEP THIS FILE CURRENT

- After any decision is locked → add to "LOCKED DECISIONS"
- After any block completes → move from "IN FLIGHT" to "COMPLETE" / "VERIFIED"
- After any new file is created → mention in the relevant section
- After any user blocker is cleared → strike from "USER BLOCKERS"
- Always commit + push to GitHub so all Claude sessions see the update on next read
