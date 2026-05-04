# Pocket Trade — Project Context

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

## BRANDING

- Dark theme: bg #0A0E1A, card #141B2D, border #1F2937
- Gains green #00D395, losses red #FF4757, accent gold #FFB800
- Text: white primary, #8B92A5 secondary
- Font: SF Pro / Roboto, monospace for prices
- Vibe: prop-firm-meets-Robinhood
- Logo: placeholder "PT" gold on dark with candlestick

## LEGAL

- Splash screen disclaimer on first launch (must dismiss)
- ToS and Privacy Policy as Markdown files in `legal/`
- LEGAL_DISCLAIMER.md notes lawyer review needed before publishing

## BUILD STATUS

### COMPLETE
- All 16 master-spec blocks implemented by Claude Code
- Backend: db.py, main.py (FastAPI + all endpoints), data_pipeline (symbol_map, fetch_stooq → yfinance, fetch_kaggle_intraday, data_ingest, fetch_news scaffold)
- Frontend: authStore, sessionStore, api service, iapService, TradingChart, OrderPanel, TradingScreen, DashboardScreen, LeaderboardScreen, DisclaimerScreen, App.tsx, app.json rebranded
- SETUP.md created

### VERIFIED
1. yfinance fetch — works, all 14 symbols, real OHLC confirmed
2. Advance endpoint — server-computed bar_index, no real timestamps to client, GET /sessions/{id} resume endpoint
3. Tournament score — exact spec match
4. Rank recalc — fires on every trade close, rolling 200 trades, exact thresholds
5. Multiple positions — JSON array, all positions checked per bar for SL/TP
6. News snapshot — honest empty array, TODO wire real source
7. State persistence — AsyncStorage + server rebuild on mount

### PENDING VERIFICATION
- symbol_map.py filename mappings match yfinance output (ES.csv vs es.f.csv)
- fetch_kaggle_intraday.py still wired for 1-min ES/NQ (not yfinance which only has 7 days intraday)

### NOT YET BUILT
- Drawing tools (Block 17 not yet specced — planned: horizontal line, trendline, rectangle, fib retracement, text label, on transparent overlay above Lightweight Charts WebView, persisted per session)
- Real news data source (FRED API recommended)
- Firebase project setup (USER BLOCKER)
- Railway deployment (USER BLOCKER)
- Kaggle API token (USER BLOCKER)
- AdMob real ad unit IDs (USER BLOCKER, test IDs work for dev)
- Apple Developer account ($99/yr) + Google Play Console ($25) (USER BLOCKERS for publish)
- Drafted ToS / Privacy Policy markdown
- Logo SVG placeholder
- Beta test plan

## USER BLOCKERS — TODO BEFORE LAUNCH

1. Create Firebase project, paste config into backend/.env + app.json Firebase block
2. Deploy backend to Railway, get URL, paste into frontend api.ts
3. Create Kaggle account, download API token to ~/.kaggle/kaggle.json
4. Create AdMob account, swap test IDs for real ones in app.json + adService.ts
5. Apple Developer Program ($99/yr) for iOS publish
6. Google Play Console ($25 one-time) for Android publish

## NEXT STEPS (TOMORROW)

1. Verify symbol_map.py filenames match yfinance output
2. Confirm fetch_kaggle_intraday.py still wired for ES/NQ 1-min
3. Spec Block 17 (drawing tools) and hand to Claude Code
4. Walk through Firebase project creation
5. Walk through Railway deployment
6. Get Kaggle API token + run data ingestion
7. Test end-to-end: signup → start session → trade → journal → leaderboard
8. Fix anything broken in real testing

## KEY DECISIONS LOCKED

- Free + ads (6 min) + $5 CAD remove-ads IAP per device
- $25k/$50k/$75k/$100k account picks
- 2 accounts max (practice + tournament)
- Random-day-at-market-open with timezone picker (no traditional sessions)
- Bar-by-bar manual + auto-play 1x-10x
- All order types, multiple positions, no commissions/spreads/slippage
- News panel at bottom labeled "News" (when wired)
- Trade journal auto-popup with auto-attach news
- Public profiles + trade feed + private group leaderboards
- 5-tier rank system (Gambler → Market Maker)
- Monthly tournaments, top 3, score with consistency multiplier
- Dark theme + gold accent
- Splash disclaimer on first launch
